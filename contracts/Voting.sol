// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Simple Voting Contract
/// @notice Allows one vote per address for a list of options
contract Voting {
    address public owner;
    bool public votingActive;
    string public title;

    string[] private options;
    mapping(uint256 => uint256) private votes;
    mapping(address => bool) public hasVoted;

    event VotingStatusChanged(bool active);
    event Voted(address indexed voter, uint256 indexed optionIndex);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    constructor(string memory _title, string[] memory _options) {
        require(bytes(_title).length > 0, "Title required");
        require(_options.length >= 2, "At least two options");
        owner = msg.sender;
        title = _title;
        options = _options;
        votingActive = true;
    }

    /// @notice Toggle voting availability
    function setVotingActive(bool active) external onlyOwner {
        votingActive = active;
        emit VotingStatusChanged(active);
    }

    /// @notice Vote for an option index
    function vote(uint256 optionIndex) external {
        require(votingActive, "Voting is not active");
        require(!hasVoted[msg.sender], "Already voted");
        require(optionIndex < options.length, "Invalid option");

        hasVoted[msg.sender] = true;
        votes[optionIndex] += 1;

        emit Voted(msg.sender, optionIndex);
    }

    /// @notice Get all options
    function getOptions() external view returns (string[] memory) {
        return options;
    }

    /// @notice Get votes per option index
    function getResults() external view returns (uint256[] memory) {
        uint256[] memory results = new uint256[](options.length);
        for (uint256 i = 0; i < options.length; i++) {
            results[i] = votes[i];
        }
        return results;
    }
}
