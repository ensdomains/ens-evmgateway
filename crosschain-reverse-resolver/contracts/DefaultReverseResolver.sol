// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import {IExtendedResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";
import {INameResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/INameResolver.sol";
import {ITextResolver} from "@ensdomains/ens-contracts/contracts/resolvers/profiles/ITextResolver.sol";
import {SignatureReverseResolver, Unauthorised} from "@ensdomains/ens-contracts/contracts/reverseRegistrar/SignatureReverseResolver.sol";
import {BytesUtils} from "@ensdomains/ens-contracts/contracts/utils/BytesUtils.sol";
import {HexUtils} from "@ensdomains/ens-contracts/contracts/utils/HexUtils.sol";

import {IDefaultReverseResolver, DEFAULT_REVERSE_NODE} from "./IDefaultReverseResolver.sol";

error InvalidAddress();

/**
 * A fallback reverser resolver to resolve when L2 reverse resolver has no names set.
 * The contract will be set under "default.reverse" namespace
 * It can only be set by EOA as contract accounts are chain dependent.
 */
contract DefaultReverseResolver is
    Ownable,
    IDefaultReverseResolver,
    IExtendedResolver,
    ERC165,
    SignatureReverseResolver
{
    uint256 constant ADDRESS_LENGTH = 40;
    using ECDSA for bytes32;
    using BytesUtils for bytes;

    /**
     * @dev Constructor
     */
    constructor() SignatureReverseResolver(DEFAULT_REVERSE_NODE, 0) {}

    function isAuthorised(address addr) internal view override {
        if (addr != msg.sender) {
            revert Unauthorised();
        }
    }

    function nameForAddr(address addr) public view returns (string memory) {
        bytes32 node = _getNamehash(addr);
        return name(node);
    }

    /**
     * @dev Sets the `name()` record for the reverse ENS record associated with
     * the calling account.
     * @param name The name to set for this address.
     * @return The ENS node hash of the reverse record.
     */
    function setName(string calldata name) public returns (bytes32) {
        return setNameForAddr(msg.sender, name);
    }

    /**
     * @dev Sets the `name()` record for the reverse ENS record associated with
     * the addr provided account.
     * Can be used if the addr is a contract that is owned by a SCW.
     * @param name The name to set for this address.
     * @return The ENS node hash of the reverse record.
     */

    function setNameForAddr(
        address addr,
        string calldata name
    ) public authorised(addr) returns (bytes32) {
        bytes32 node = _getNamehash(addr);

        _setName(node, name);
        emit ReverseClaimed(addr, node);

        return node;
    }

    /*
     * @dev Resolve and verify a record stored in l2 target address. It supports fallback to the default resolver
     * @param name DNS encoded ENS name to query
     * @param data The actual calldata
     * @return result result of the call
     */
    function resolve(bytes calldata _name, bytes calldata data) external view returns (bytes memory result) {
        bytes4 selector = bytes4(data);
        (address addr, bool valid) = HexUtils.hexToAddress(_name, 1, ADDRESS_LENGTH + 1);
        
        if (!valid) revert InvalidAddress();

        if (selector == INameResolver.name.selector) return bytes(nameForAddr(addr));
    }

    function supportsInterface(
        bytes4 interfaceID
    ) public view override(ERC165, SignatureReverseResolver) returns (bool) {
        return
            interfaceID == type(IExtendedResolver).interfaceId ||
            super.supportsInterface(interfaceID);
    }
}
