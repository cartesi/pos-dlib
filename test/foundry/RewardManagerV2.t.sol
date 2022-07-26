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

    function testRewardV1(uint32 _i) public {
        rm.reward(_i, address(this));
    }

    function testRewardV2() public {
        uint32 i;
        for (uint32 j = 1; j <= 10; ++j) {
            uint32[] memory blocks = new uint32[](j);

            for (uint32 k; k < j; ++k & ++i) {
                blocks[k] = i;
            }

            rm.reward(blocks);
        }
    }

    function testRewardV1Revert() public {
        vm.prank(address(900));
        vm.expectRevert(bytes("Only the pos contract can call"));
        rm.reward(0, address(this));
    }

    function testRewardV2Revert() public {
        uint32[] memory blocks = new uint32[](10);

        for (uint32 i; i < 10; ++i) {
            blocks[i] = i;
        }

        vm.mockCall(
            mockContract,
            abi.encodeWithSelector(IERC20.balanceOf.selector),
            abi.encode(0)
        );

        vm.expectRevert(bytes("RewardManager has no funds"));
        rm.reward(blocks);

        vm.mockCall(
            mockContract,
            abi.encodeWithSelector(IHistoricalData.isValidBlock.selector),
            abi.encode(0, msg.sender)
        );

        vm.expectRevert(bytes("Invalid block"));
        rm.reward(blocks);
    }
}
