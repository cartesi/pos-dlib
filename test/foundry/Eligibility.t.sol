pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "contracts/v2/EligibilityCalImpl.sol";

contract EligibilityTest is Test, EligibilityCalImpl {
    uint256 constant initDiff = 100000000000000000000000000;
    uint256 constant minDiff = 1000000000;
    uint256 constant bigWeight = 10000000000000000000000000000;
    uint256 constant smallWeight = 100;

    function setUp() public {}

    function testEligibility(
        uint256 _difficulty,
        uint256 _ethBlockStamp,
        address _user,
        uint256 _weight
    ) public {
        vm.assume(_difficulty >= minDiff); // min difficulty
        vm.assume(_difficulty <= 100 * initDiff); // 100 times initial difficulty
        vm.assume(_ethBlockStamp <= UINT256_MAX - 512);
        vm.assume(_weight <= bigWeight); // total circulation of CTSI

        for (uint256 i; i <= 512; ++i) {
            // TODO: write to a file for statistically analysis
            vm.roll(_ethBlockStamp + i);
            whenCanProduceBlock(_difficulty, _ethBlockStamp, _user, _weight);
        }
    }

    function testEligibilityEdgeCase() public {
        uint256 ethBlockStamp = block.number;

        vm.roll(ethBlockStamp + 41);
        assertEq(
            UINT256_MAX,
            whenCanProduceBlock(minDiff, ethBlockStamp, address(this), 0),
            "return UINT256_MAX when stake is 0"
        );

        vm.roll(ethBlockStamp + 40);
        assertEq(
            UINT256_MAX,
            whenCanProduceBlock(
                minDiff,
                ethBlockStamp,
                address(this),
                bigWeight
            ),
            "return UINT256_MAX when goal is not set"
        );

        vm.roll(ethBlockStamp + 41);
        assertTrue(
            UINT256_MAX >
                whenCanProduceBlock(
                    minDiff,
                    ethBlockStamp,
                    address(this),
                    smallWeight
                ),
            "return valid number for next eligibility (small stake)"
        );

        vm.roll(ethBlockStamp + 41);
        assertTrue(
            UINT256_MAX >
                whenCanProduceBlock(
                    minDiff,
                    ethBlockStamp,
                    address(this),
                    bigWeight
                ),
            "return valid number for next eligibility (big stake)"
        );
    }

    function testSelectionBlocksPassed(uint256 _ethBlockStamp) public {
        vm.assume(_ethBlockStamp <= UINT256_MAX - 512);

        for (uint256 i; i <= 512; ++i) {
            // TODO: write to a file for statistically analysis
            vm.roll(_ethBlockStamp + i);
            getSelectionBlocksPassed(_ethBlockStamp);
        }
    }

    function testSmallStakers() public {
        address[400] memory wallets;
        // derive 400 wallets from hardhat mnemonic to match BlockSelectorV2 regression test
        string
            memory mnemonic = "test test test test test test test test test test test junk";
        for (uint32 i; i < 400; ++i) {
            uint256 privateKey = vm.deriveKey(mnemonic, i);
            wallets[i] = vm.addr(privateKey);
        }
        // 15k, 500k, 2M, 20M
        uint256[4] memory weights = [
            uint256(1e18 * (15 * 1000)),
            uint256(1e18 * (500 * 1000)),
            uint256(1e18 * (2 * 1e6)),
            uint256(1e18 * (20 * 1e6))
        ];
        uint256[4] memory counts;
        uint256 mainchainDifficulty = 25798284791319440457930; // extracted from mainnet; 240mi ctsi staked
        uint256 ethBlockStamp = block.number;

        vm.roll(ethBlockStamp + 254);

        for (uint256 i; i < 100; ++i) {
            for (uint256 j; j < wallets.length; ++j) {
                for (uint256 k; k < weights.length; ++k) {
                    if (
                        canProduceBlock(
                            mainchainDifficulty,
                            ethBlockStamp,
                            wallets[j],
                            weights[k]
                        )
                    ) {
                        counts[k]++;
                    }
                }
            }
            vm.roll(block.number + 256);
        }

        assertLt(
            counts[0],
            counts[1],
            "lowest weight count should be less than low weight count"
        );
        assertLt(
            counts[1],
            counts[2],
            "low weight count should be less than medium weight count"
        );
        assertLt(
            counts[2],
            counts[3],
            "medium weight count should be less than high weight count"
        );

        console.log("lowestWeightCount: ", counts[0]);
        console.log("lowWeightCount: ", counts[1]);
        console.log("mediumWeightCount: ", counts[2]);
        console.log("highWeightCount: ", counts[3]);
    }
}
