pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "@cartesi/util/contracts/CartesiMath.sol";
import "@cartesi/util/contracts/Instantiator.sol";
import "@cartesi/util/contracts/Decorated.sol";


import "./StakingInterface.sol";

contract Lottery is Instantiator, Decorated, CartesiMath{
    using SafeMath for uint256;

    struct LotteryCtx {
        mapping(uint256 => address) roundWinner; // each rounds winner
        uint256 roundCount; // how many draw rounds happened
        uint256 currentDrawStartTime; // timestamp of when current draw started
        uint256 difficulty; // difficulty parameter defines how big the interval will be
        uint256 difficultyAdjustmentParameter; // how fast the difficulty gets adjusted to reach the desired draw time, number * 1000000
        uint256 desiredDrawTimeInterval; // desired draw time interval, used to tune difficulty
        uint256 currentGoalBlockNumber; // block number which will decide current draw's goal

        StakingInterface staking; // Staking contract interface
    }

    mapping(uint256 => LotteryCtx) internal instance;

    /// @notice Instantiates a Speed Bump structure
    /// @param _difficultyAdjustmentParameter how quickly the difficulty gets updated
    /// according to the difference between time passed and desired draw time interval.
    /// @param _desiredDrawTimeInterval how often we want to elect a winner
    /// @param _stakingAddress address of StakingInterface
    function instantiate(
        uint256 _difficultyAdjustmentParameter,
        uint256 _desiredDrawTimeInterval,
        StakingInterface _stakingAddress) public returns (uint256)
    {
        require(_desiredDrawTimeInterval > 30, "Desired draw time interval has to be bigger than 30 seconds");
        instance[currentIndex].difficulty = 1000000;
        instance[currentIndex].difficultyAdjustmentParameter = _difficultyAdjustmentParameter;
        instance[currentIndex].desiredDrawTimeInterval = _desiredDrawTimeInterval;
        instance[currentIndex].staking = StakingInterface(_stakingAddress);

        instance[currentIndex].currentGoalBlockNumber = block.number + 1; // goal has to be in the future, so miner cant manipulate (easily)
        instance[currentIndex].currentDrawStartTime = now; // first draw starts when the instance is created

        active[currentIndex] = true;
        return currentIndex++;
    }

    /// @notice Calculates the log of the distance between the goal and callers address
    /// @param _index the index of the instance of speedbump you want to interact with
    function getLogOfDistance(uint256 _index) internal view returns (uint256) {
        bytes32 currentGoal = blockhash(instance[_index].currentGoalBlockNumber);
        bytes32 hashedAddress = keccak256(abi.encodePacked(msg.sender));
        uint256 distance = uint256(keccak256(abi.encodePacked(hashedAddress, currentGoal)));

        return CartesiMath.log2ApproxTimes1M(distance);
    }

    /// @notice Claim yourself as the winner of a round
    /// @param _index the index of the instance of speedbump you want to interact with
    function claimRound(uint256 _index) public returns (bool) {

        if ((block.number).sub(instance[_index].currentGoalBlockNumber) > 220) {
            // cannot get hash of block if its older than 256, we set 220 to avoid edge cases
            // so whoever calls this wins the round (if they have at least 1 ctsi staked)
            // new goal cannot be in the past, otherwise user could "choose it"
            require(instance[_index].staking.getStakedBalance(0, msg.sender) > 0, "Caller must have at least one staked token");
            return _roundFinished(_index);
        }

        uint256 timePassedMicroSeconds = (now.sub(instance[_index].currentDrawStartTime)).mul(1000000); // time since draw started times 1e6 (microseconds)
        uint256 stakedBalance = instance[_index].staking.getStakedBalance(0, msg.sender);
        // multiplications shouldnt overflow, subtraction should
        if ((stakedBalance.mul(timePassedMicroSeconds)) > instance[_index].difficulty.mul((256000000 - getLogOfDistance(_index)))) {
            return _roundFinished(_index);
        }
        return false;
    }
    /// @notice Finish Round, declare winner and ajust difficulty
    /// @param _index the index of the instance of speedbump you want to interact with
    function _roundFinished(uint256 _index) private returns (bool) {
        // declare winner
        instance[_index].roundWinner[instance[_index].roundCount] = msg.sender;
        // adjust difficulty
        instance[_index].difficulty = getNewDifficulty(
            instance[_index].difficulty,
            now.sub(instance[_index].currentDrawStartTime),
            instance[_index].desiredDrawTimeInterval,
            instance[_index].difficultyAdjustmentParameter
        );

        _reset(_index);
        return true;
    }

    /// @notice Reset instance, advancing round and choosing new goal
    /// @param _index the index of the instance of speedbump you want to interact with
    function _reset(uint256 _index) private {
        instance[_index].roundCount++;
        instance[_index].currentGoalBlockNumber = block.number + 1;
        instance[_index].currentDrawStartTime = now;
    }

    /// @notice Calculates new difficulty parameter
    /// @param _oldDifficulty is the difficulty of previous round
    /// @param _timePassed is how long the previous round took
    /// @param _desiredDrawTime is how long a round is supposed to take
    /// @param _adjustmentParam is how fast the difficulty gets adjusted, should be number * 1000000
    function getNewDifficulty(uint256 _oldDifficulty, uint256 _timePassed, uint256 _desiredDrawTime, uint256 _adjustmentParam) internal pure returns (uint256) {
        if (_timePassed < _desiredDrawTime) {
            return _oldDifficulty.mul(_adjustmentParam).div(1000000) + 1;
        } else if (_timePassed > _desiredDrawTime) {
            return _oldDifficulty.mul(1000000).div(_adjustmentParam) + 1;
        }

        return _oldDifficulty;
    }

    function getState(uint256 _index, address _user)
    public view returns (uint256[6] memory _uintValues) {
        LotteryCtx memory i = instance[_index];

        uint256[6] memory uintValues = [
            block.number,
            i.currentGoalBlockNumber,
            i.difficulty,
            i.staking.getStakedBalance(0, _user),
            (now.sub(i.currentDrawStartTime)).mul(1000000), // time passed
            getLogOfDistance(_index)
        ];

        return uintValues;
    }

    function isConcerned(uint256 _index, address _user) public view returns (bool) {
        return instance[_index].staking.getStakedBalance(0, _user) > 0;
    }
}
