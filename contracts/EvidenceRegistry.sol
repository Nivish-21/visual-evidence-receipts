// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract EvidenceRegistry {
    address public immutable issuer;
    bytes32 public immutable collectorKeyId;
    mapping(bytes32 => bool) public anchored;

    event EvidenceAnchored(
        bytes32 indexed receiptHash,
        bytes32 indexed collectorKeyId,
        string schemaVersion,
        string policyVersion,
        address indexed issuer
    );

    constructor(address allowedIssuer, bytes32 allowedCollectorKeyId) {
        issuer = allowedIssuer;
        collectorKeyId = allowedCollectorKeyId;
    }

    function anchor(bytes32 receiptHash, bytes32 keyId, string calldata schemaVersion, string calldata policyVersion) external {
        require(msg.sender == issuer, "issuer only");
        require(keyId == collectorKeyId, "collector key mismatch");
        require(!anchored[receiptHash], "duplicate receipt");
        anchored[receiptHash] = true;
        emit EvidenceAnchored(receiptHash, keyId, schemaVersion, policyVersion, msg.sender);
    }
}
