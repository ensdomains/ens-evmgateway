// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import {EVMFetcher} from '@ensdomains/evm-verifier/contracts/EVMFetcher.sol';
import {EVMFetchTarget} from '@ensdomains/evm-verifier/contracts/EVMFetchTarget.sol';
import {IEVMVerifier} from '@ensdomains/evm-verifier/contracts/IEVMVerifier.sol';
import {INameResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/INameResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/ITextResolver.sol";
import "@ensdomains/ens-contracts/contracts/utils/HexUtils.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";

import "./IDefaultReverseResolver.sol";

contract L1ReverseResolver is EVMFetchTarget, IExtendedResolver, ERC165 {
    using EVMFetcher for EVMFetcher.EVMFetchRequest;
    using HexUtils for bytes;

    ENS immutable ens;
    IEVMVerifier immutable verifier;
    address immutable target;

    uint256 constant NAMES_SLOT = 0;
    uint256 constant ADDRESS_LENGTH = 40;

    constructor(ENS _ens, IEVMVerifier _verifier, address _target) {
        ens = _ens;
        verifier = _verifier;
        target = _target;
    }

    /** 
     * @dev Resolve and verify a record stored in l2 target address. It supports fallback to the default resolver
     * @param name DNS encoded ENS name to query
     * @param data The actual calldata
     * @return result result of the call
     */
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory result) {
        bytes4 selector = bytes4(data);
        (address addr,) = HexUtils.hexToAddress(name, 1, ADDRESS_LENGTH + 1);
        if (selector == INameResolver.name.selector) {
            (bytes32 node) = abi.decode(data[4:], (bytes32));
            return bytes(_name(node, addr));
        }
    }

    function _name(bytes32 node, address addr) private view returns (string memory) {
        EVMFetcher.newFetchRequest(verifier, target)
            .getDynamic(NAMES_SLOT)
              .element(node)
            .fetch(this.nameCallback.selector, abi.encode(addr));
    }

    function nameCallback(
        bytes[] memory values,
        bytes memory callbackdata
    ) public view returns (bytes memory) {        
        if (values[0].length == 0 ) {
            (address addr) = abi.decode(callbackdata, (address));
            return abi.encode(getDefaultNameFromAddr(addr));
        } else {
            return abi.encode(values[0]);
        }
    }

    function getDefaultNameFromAddr(address addr) internal view returns (string memory) {
        IDefaultReverseResolver defaultReverseResolver = IDefaultReverseResolver(ens.resolver(DEFAULT_REVERSE_NODE));
        return defaultReverseResolver.nameForAddr(addr);
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public override view returns (bool) {
        return
            interfaceId == type(IExtendedResolver).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
