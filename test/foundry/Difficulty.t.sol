pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "contracts/v2/DifficultyManagerImpl.sol";

contract DifficultyTest is Test, DifficultyManagerImpl {
    function setUp() public {}

    // UINT64_MAX = 18446744073709551615
    // real world values:
    // uint64 _minDifficulty,
    // uint64 _initialDifficulty,
    // uint32 _difficultyAdjustmentParameter,
    // uint32 _targetInterval
    constructor()
        DifficultyManagerImpl(1000000000, 1000000000000, 50000, 138)
    {}

    function testDifficultyAdjustment() public {
        for (uint256 i; i < 512; ++i) {
            // TODO: write to a file for statistically analysis
            adjustDifficulty(i);
        }
    }
}
