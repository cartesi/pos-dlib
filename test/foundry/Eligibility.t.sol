pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "contracts/v2/EligibilityCalImpl.sol";

contract EligibilityTest is Test, EligibilityCalImpl {

    function setUp() public {}

    function testEligibility(
        uint256 _difficulty,
        uint256 _ethBlockStamp,
        address _user,
        uint256 _weight
    ) public {
        vm.assume(_difficulty >= 1000000000); // min difficulty
        vm.assume(_difficulty <= 10000000000000000000000000000); // 100 times initial difficulty
        vm.assume(_ethBlockStamp <= UINT256_MAX - 512);
        vm.assume(_weight <= 10000000000000000000000000000); // total circulation of CTSI

        for (uint256 i; i <= 512; ++i) {
            // TODO: write to a file for statistically analysis
            vm.roll(_ethBlockStamp + i);
            whenCanProduceBlock(_difficulty, _ethBlockStamp, _user, _weight);
        }
    }

    function testSelectionBlocksPassed(uint256 _ethBlockStamp) public {
        vm.assume(_ethBlockStamp <= UINT256_MAX - 512);

        for (uint256 i; i <= 512; ++i) {
            // TODO: write to a file for statistically analysis
            vm.roll(_ethBlockStamp + i);
            getSelectionBlocksPassed(_ethBlockStamp);
        }
    }
}
