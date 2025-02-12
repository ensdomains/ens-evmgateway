// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {INameResolver} from '@ensdomains/ens-contracts/contracts/resolvers/profiles/INameResolver.sol';
import {IAddrResolver} from '@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddrResolver.sol';
import {IAddressResolver} from '@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol';
import {HexUtils} from '@ensdomains/ens-contracts/contracts/utils/HexUtils.sol';
import {IExtendedResolver} from '@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol';
import {IStandaloneReverseRegistrar} from '@ensdomains/ens-contracts/contracts/reverseRegistrar/IStandaloneReverseRegistrar.sol';
import {ENS} from '@ensdomains/ens-contracts/contracts/registry/ENS.sol';
import {ERC165} from '@openzeppelin/contracts/utils/introspection/ERC165.sol';
import {Ownable} from '@openzeppelin/contracts/access/Ownable.sol';
import {GatewayFetchTarget, IGatewayVerifier} from '@unruggable/gateways/contracts/GatewayFetchTarget.sol';
import {GatewayFetcher, GatewayRequest} from '@unruggable/gateways/contracts/GatewayFetcher.sol';

/// @title L1 Reverse Resolver
/// @notice Resolves reverse records for an L2 chain. Deployed on the L1 chain.
contract L1ReverseResolver is
    GatewayFetchTarget,
    IExtendedResolver,
    ERC165,
    Ownable
{
    using GatewayFetcher for GatewayRequest;

    /// @notice The namehash of 'default.reverse'
    bytes32 constant DEFAULT_REVERSE_NODE =
        0x53a2e7cce84726721578c676b4798972d354dd7c62c832415371716693edd312;

    /// @notice The ENS registry contract.
    ENS immutable ens;

    /// @notice The gateway verifier contract, unique to each L2 chain.
    IGatewayVerifier immutable verifier;

    /// @notice The target registrar contract on the L2 chain.
    address immutable target;

    /// @notice A keccak256 hash of the DNS encoded reverse name.
    ///         NOT using the ENS namehash algorithm
    bytes32 internal immutable _dnsEncodedReverseNameHash;

    /// @notice Storage slot for the names mapping in the target registrar contract.
    uint256 internal constant NAMES_SLOT = 0;

    /// @notice The length of an address in bytes.
    uint256 internal constant ADDRESS_LENGTH = 40;

    /// @notice The verifier gateway URLs.
    string[] internal _urls;

    /// @notice Emitted when the gateway URLs are changed.
    event GatewayURLsChanged(string[] urls);

    /// @notice Sets the initial state of the contract.
    ///
    /// @param owner_ The owner of the contract, able to modify the gateway URLs.
    /// @param ens_ The ENS registry contract.
    /// @param verifier_ The gateway verifier contract, unique to each L2 chain.
    /// @param target_ The target registrar contract on the L2 chain.
    /// @param dnsEncodedReverseNameHash_ A keccak256 hash of the DNS encoded reverse name.
    /// @param urls_ The verifier gateway URLs.
    constructor(
        address owner_,
        ENS ens_,
        IGatewayVerifier verifier_,
        address target_,
        bytes32 dnsEncodedReverseNameHash_,
        string[] memory urls_
    ) Ownable(owner_) {
        ens = ens_;
        verifier = verifier_;
        target = target_;
        _dnsEncodedReverseNameHash = dnsEncodedReverseNameHash_;
        _urls = urls_;
    }

    /// @notice Sets the gateway URLs.
    ///
    /// @param urls The new gateway URLs.
    function setGatewayURLs(string[] memory urls) external onlyOwner {
        _urls = urls;
        emit GatewayURLsChanged(urls);
    }

    /// @notice Gets the gateway URLs.
    ///
    /// @return The gateway URLs.
    function gatewayURLs() external view returns (string[] memory) {
        return _urls;
    }

    /// @notice Resolves and verifies `name` records on the target L2 chain's registrar contract,
    ///         or falls back to the default resolver if the name is not found.
    ///         Also supports `addr` calls for the L2 chain's reverse namespace,
    ///         which resolves to the target L2 chain's registrar contract.
    ///
    /// @param name The DNS encoded ENS name to query.
    /// @param data The resolver calldata.
    /// @return result The result of the call.
    function resolve(
        bytes calldata name,
        bytes calldata data
    ) external view returns (bytes memory result) {
        bytes4 selector = bytes4(data);
        if (selector == INameResolver.name.selector) {
            (address addr, ) = HexUtils.hexToAddress(
                name,
                1,
                ADDRESS_LENGTH + 1
            );
            // Always throws, does not need to return.
            _fetchName(addr);
        } else if (
            selector == IAddrResolver.addr.selector ||
            selector == IAddressResolver.addr.selector
        ) {
            if (keccak256(name) == _dnsEncodedReverseNameHash)
                return abi.encode(target);
        }
    }

    /// @notice Callback function, called by the verifier contract.
    ///
    /// @dev If the returned value is empty, data is returned from the default resolver.
    ///
    /// @param values The values returned from the verifier contract.
    ///               Should be a single value.
    /// @param carry The address to query the default resolver for, ABI encoded.
    /// @return The name for the given address, ABI encoded.
    function fetchNameCallback(
        bytes[] memory values,
        uint8 /* exitCode */,
        bytes memory carry
    ) external view returns (bytes memory) {
        if (values[0].length == 0) {
            address addr = abi.decode(carry, (address));
            return abi.encode(_getDefaultNameFromAddr(addr));
        } else {
            return abi.encode(values[0]);
        }
    }

    /// @dev Fetches the name for a given node using the verifier contract.
    ///
    /// @param addr The address used for the query.
    function _fetchName(address addr) internal view {
        fetch(
            // Verifier target
            verifier,
            // Gateway request
            // 1 request to L2 target registrar contract
            // Gets data for `names[addr]`
            GatewayFetcher
                .newRequest(1)
                .setTarget(target)
                .setSlot(NAMES_SLOT)
                .push(bytes32(uint256(uint160(addr))))
                .follow()
                .readBytes()
                .setOutput(0),
            // Callback function
            this.fetchNameCallback.selector,
            // Carry data, for default fallback
            abi.encode(addr),
            // Gateway URLs
            _urls
        );
    }

    /// @dev Resolves the default reverse registrar, and returns the name for the given address.
    ///
    /// @param addr The address to query the default resolver for.
    /// @return The default name for the given address.
    function _getDefaultNameFromAddr(
        address addr
    ) internal view returns (string memory) {
        IStandaloneReverseRegistrar defaultReverseRegistrar = IStandaloneReverseRegistrar(
                ens.resolver(DEFAULT_REVERSE_NODE)
            );
        return defaultReverseRegistrar.nameForAddr(addr);
    }

    /// @inheritdoc ERC165
    function supportsInterface(
        bytes4 interfaceId
    ) public view override returns (bool) {
        return
            interfaceId == type(IExtendedResolver).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
