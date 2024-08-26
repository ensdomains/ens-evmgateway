// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// The namehash of 'default.reverse'
bytes32 constant DEFAULT_REVERSE_NODE =
    0x53a2e7cce84726721578c676b4798972d354dd7c62c832415371716693edd312;

interface IDefaultReverseResolver {
    function nameForAddr(address addr) external view returns (string memory);

    function setName(string memory name) external returns (bytes32);

    function setNameForAddr(
        address addr,
        string memory name
    ) external returns (bytes32);
}

