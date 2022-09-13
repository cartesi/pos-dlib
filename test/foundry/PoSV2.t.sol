pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import "contracts/v2/PoSV2Impl.sol";
import "contracts/IStaking.sol";
import "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import "@cartesi/util/contracts/IWorkerAuthManager.sol";

contract PoSV2Test is Test {
    PoSV2Impl pos;
    PoSV2Impl pos2;
    address mockContract;
    uint32 constant minDiff = 100;
    uint32 constant initialDiff = 100;
    uint32 constant diffAdjust = 1;
    uint32 constant targetInterval = 138;

    // RewardManager constructor parameters
    uint256 constant rewardValue = 1000;
    uint32 constant rewardDelay = 0;

    function setUp() public {
        mockContract = address(this);

        pos = new PoSV2Impl(
            mockContract,
            mockContract,
            mockContract,
            initialDiff,
            minDiff,
            diffAdjust,
            targetInterval,
            rewardValue,
            rewardDelay,
            1
        );
        pos2 = new PoSV2Impl(
            mockContract,
            mockContract,
            mockContract,
            initialDiff,
            minDiff,
            diffAdjust,
            targetInterval,
            rewardValue,
            rewardDelay,
            2
        );

        // mocking calls
        vm.mockCall(
            mockContract,
            abi.encodeWithSelector(IWorkerAuthManager.isAuthorized.selector),
            abi.encode(1)
        );
        vm.mockCall(
            mockContract,
            abi.encodeWithSelector(IWorkerAuthManager.getOwner.selector),
            abi.encode(msg.sender)
        );
        vm.mockCall(
            mockContract,
            abi.encodeWithSelector(IStaking.getStakedBalance.selector),
            abi.encode(100000000)
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

    function testProduceBlockV1() public {
        vm.roll(block.number + 50);

        for (uint256 i; i < 1000; ++i) {
            pos.produceBlock(0);
            vm.roll(block.number + 250);
        }
    }

    function testProduceBlockV2() public {
        vm.roll(block.number + 50);
        pos2.produceBlock(0, "test");

        for (uint32 i; i < 1000; ++i) {
            vm.roll(block.number + 250);
            pos2.produceBlock(i, "test");
        }
    }
}
