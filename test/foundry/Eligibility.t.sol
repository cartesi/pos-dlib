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
        address[20] memory wallets = [
            address(0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266),
            address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8),
            address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC),
            address(0x90F79bf6EB2c4f870365E785982E1f101E93b906),
            address(0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65),
            address(0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc),
            address(0x976EA74026E726554dB657fA54763abd0C3a0aa9),
            address(0x14dC79964da2C08b23698B3D3cc7Ca32193d9955),
            address(0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f),
            address(0xa0Ee7A142d267C1f36714E4a8F75612F20a79720),
            address(0xBcd4042DE499D14e55001CcbB24a551F3b954096),
            address(0x71bE63f3384f5fb98995898A86B02Fb2426c5788),
            address(0xFABB0ac9d68B0B445fB7357272Ff202C5651694a),
            address(0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec),
            address(0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097),
            address(0xcd3B766CCDd6AE721141F452C550Ca635964ce71),
            address(0x2546BcD3c84621e976D8185a91A922aE77ECEc30),
            address(0xbDA5747bFD65F08deb54cb465eB87D40e51B197E),
            address(0xdD2FD4581271e230360230F9337D5c0430Bf44C0),
            address(0x8626f6940E2eb28930eFb4CeF49B2d1F2C9C1199)
        ];
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
    }
}
