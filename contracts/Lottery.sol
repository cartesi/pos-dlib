// Copyright (C) 2020 Cartesi Pte. Ltd.

// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version.

// This program is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
// PARTICULAR PURPOSE. See the GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Note: This component currently has dependencies that are licensed under the GNU
// GPL, version 3, and so you should treat this component as a whole as being under
// the GPL version 3. But all Cartesi-written code in this component is licensed
// under the Apache License, version 2, or a compatible permissive license, and can
// be used independently under the Apache v2 license. After this component is
// rewritten, the entire component will be released under the Apache v2 license.

/// @title Lottery
/// @author Felipe Argento

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "@cartesi/util/contracts/CartesiMath.sol";
import "@cartesi/util/contracts/Instantiator.sol";
import "@cartesi/util/contracts/Decorated.sol";


import "./StakingInterface.sol";
import "./PrizeManager.sol";

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

        address posManagerAddress;

        PrizeManager prizeManager; // Contract that distributes the prize
    }

    mapping(uint256 => LotteryCtx) internal instance;

    event RoundClaimed(
        address _winner,
        uint256 _roundCount,
        uint256 _roundDuration,
        uint256 _difficulty
    );

    /// @notice Instantiates a Speed Bump structure
    /// @param _difficultyAdjustmentParameter how quickly the difficulty gets updated
    /// according to the difference between time passed and desired draw time interval.
    /// @param _desiredDrawTimeInterval how often we want to elect a winner
    function instantiate(
        uint256 _difficultyAdjustmentParameter,
        uint256 _desiredDrawTimeInterval,
        address _prizeManagerAddress,
        address _posManagerAddress
    ) public returns (uint256)
    {
        require(_desiredDrawTimeInterval > 30, "Desired draw time interval has to be bigger than 30 seconds");
        instance[currentIndex].difficulty = 1000000;
        instance[currentIndex].difficultyAdjustmentParameter = _difficultyAdjustmentParameter;
        instance[currentIndex].desiredDrawTimeInterval = _desiredDrawTimeInterval;
        instance[currentIndex].prizeManager = PrizeManager(_prizeManagerAddress);
        instance[currentIndex].posManagerAddress = _posManagerAddress;

        instance[currentIndex].currentGoalBlockNumber = block.number + 1; // goal has to be in the future, so miner cant manipulate (easily)
        instance[currentIndex].currentDrawStartTime = now; // first draw starts when the instance is created

        active[currentIndex] = true;
        return currentIndex++;
    }

    /// @notice Calculates the log of the distance between the goal and callers address
    /// @param _index the index of the instance of speedbump you want to interact with
    function getLogOfRandom(uint256 _index, address _user) internal view returns (uint256) {
        bytes32 currentGoal = blockhash(instance[_index].currentGoalBlockNumber);
        bytes32 hashedAddress = keccak256(abi.encodePacked(_user));
        uint256 distance = uint256(keccak256(abi.encodePacked(hashedAddress, currentGoal)));

        return CartesiMath.log2ApproxTimes1M(distance);
    }

    /// @notice Claim yourself as the winner of a round
    /// @param _index the index of the instance of speedbump you want to interact with
    /// @param _user address that will win the lottery
    function claimRound(uint256 _index, address _user, uint256 _weigth) public returns (bool) {
        LotteryCtx storage lot = instance[_index];

        require(_weigth > 0, "Caller must have at least one staked token");
        require(msg.sender == lot.posManagerAddress, "Funciton can only be called by pos prototype address");

        uint256 timePassedMicroSeconds = (now.sub(lot.currentDrawStartTime)).mul(1000000); // time since draw started times 1e6 (microseconds)

        if (canWin(_index, _user, _weigth)) {
            emit RoundClaimed(
                _user,
                lot.roundCount,
                timePassedMicroSeconds,
                lot.difficulty
            );

            return _roundFinished(_index, _user);
        }

        return false;
    }

    /// @notice Check if address can win current round
    /// @param _index the index of the instance of speedbump you want to interact with
    /// @param _user the address that is gonna get checked
    function canWin(uint256 _index, address _user, uint256 _weigth) public view returns (bool) {
        LotteryCtx storage lot = instance[_index];

        uint256 timePassedMicroSeconds = (now.sub(lot.currentDrawStartTime)).mul(1000000); // time since draw started times 1e6 (microseconds)

        // cannot get hash of block if its older than 256, we set 220 to avoid edge cases
        // new goal cannot be in the past, otherwise user could "choose it"
        return (block.number).sub(lot.currentGoalBlockNumber) > 220 || (_weigth.mul(timePassedMicroSeconds)) > lot.difficulty.mul((256000000 - getLogOfRandom(_index, _user)));
    }

    /// @notice Finish Round, declare winner and ajust difficulty
    /// @param _index the index of the instance of speedbump you want to interact with
    function _roundFinished(uint256 _index, address _user) private returns (bool) {
        LotteryCtx storage lot = instance[_index];
        // declare winner
        lot.roundWinner[lot.roundCount] = _user;

        // pay winner
        lot.prizeManager.payWinner(_user);

        // adjust difficulty
        lot.difficulty = getNewDifficulty(
            lot.difficulty,
            now.sub(lot.currentDrawStartTime),
            lot.desiredDrawTimeInterval,
            lot.difficultyAdjustmentParameter
        );

        _reset(_index);
        return true;
    }

    /// @notice Reset instance, advancing round and choosing new goal
    /// @param _index the index of the instance of speedbump you want to interact with
    function _reset(uint256 _index) private {
        LotteryCtx storage lot = instance[_index];

        lot.roundCount++;
        lot.currentGoalBlockNumber = block.number + 1;
        lot.currentDrawStartTime = now;
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
    public view returns (uint256[5] memory _uintValues) {
        LotteryCtx memory i = instance[_index];

        uint256[5] memory uintValues = [
            block.number,
            i.currentGoalBlockNumber,
            i.difficulty,
            (now.sub(i.currentDrawStartTime)).mul(1000000), // time passed
            getLogOfRandom(_index, _user)
        ];

        return uintValues;
    }

    function isConcerned(uint256, address) public override view returns (bool) {
        return false; // isConcerned is only for the main concern (PoS prototype)
    }

    function getSubInstances(uint256, address)
        public override view returns (address[] memory _addresses,
            uint256[] memory _indices)
    {
        address[] memory a;
        uint256[] memory i;

        a = new address[](0);
        i = new uint256[](0);

        return (a, i);
    }
}
