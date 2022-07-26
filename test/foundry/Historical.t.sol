pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "contracts/v2/HistoricalDataImpl.sol";

contract HistoricalTest is Test, HistoricalDataImpl {
    uint256 constant sidechainBlocksIn1Year = 365 * 24 * 2;

    function setUp() public {}

    function testLatest() public {
        // genesis block
        uint256 latest = recordBlock(0, address(this), "test");

        for (uint256 i = 1; i < 5 * sidechainBlocksIn1Year; ++i) {
            uint256 newBlock = recordBlock(latest, address(this), "test");

            assertEq(latest + 1, newBlock, "latest block should be increment");

            latest = newBlock;
        }
    }
}
