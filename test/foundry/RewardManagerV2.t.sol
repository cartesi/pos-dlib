pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "contracts/v2/RewardManagerV2Impl.sol";
import "contracts/v2/IHistoricalData.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";

contract RMV2Test is Test {
    RewardManagerV2Impl rm;
    address mockContract;
    uint256 constant rewardValue = 1000;
    uint32 constant rewardDelay = 0;

    function setUp() public {
        mockContract = address(this);

        rm = new RewardManagerV2Impl(
            mockContract,
            mockContract,
            rewardValue,
            rewardDelay
        );

        // mocking calls
        vm.mockCall(
            mockContract,
            abi.encodeWithSelector(IHistoricalData.isValidBlock.selector),
            abi.encode(1, msg.sender)
        );
        vm.mockCall(
            mockContract,
            abi.encodeWithSelector(IERC20.balanceOf.selector),
            abi.encode(rewardValue)
        );
        vm.mockCall(
            mockContract,
            abi.encodeWithSelector(IERC20.transfer.selector),
            abi.encode(1)
        );
    }

    function testRewardV1() public {
        for (uint32 i; i < 1000; ++i) {
            rm.reward(i, address(this));
        }
    }

    function testRewardV2() public {
        for (uint32 i; i < 1000; ++i) {
            rm.reward(i);
        }
    }
}
