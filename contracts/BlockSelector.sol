// Copyright (C) 2020 Cartesi Pte. Ltd.

// SPDX-License-Identifier: GPL-3.0-only
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

/// @title Block Selector

pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";

import "@cartesi/util/contracts/CartesiMath.sol";
import "@cartesi/util/contracts/InstantiatorImpl.sol";
import "@cartesi/util/contracts/Decorated.sol";

contract BlockSelector is InstantiatorImpl, Decorated, CartesiMath {
    using SafeMath for uint256;

    struct BlockSelectorCtx {
        mapping(uint256 => address) blockProducer; // block index to block producer
        uint256 blockCount; // how many blocks have been created
        uint256 blockSelectionTimestamp; // timestamp of when current selection started
        uint256 difficulty; // difficulty parameter defines how big the interval will be
        uint256 minDifficulty; // lower bound for difficulty
        uint256 difficultyAdjustmentParameter; // how fast the difficulty gets adjusted to reach the desired interval, number * 1000000
        uint256 targetInterval; // desired block selection interval, used to tune difficulty
        uint256 currentGoalBlockNumber; // main chain block number which will decide current random target

        address posManagerAddress;

    }

    mapping(uint256 => BlockSelectorCtx) internal instance;

    event BlockProduced(
        uint256 indexed index,
        address indexed winner,
        uint256 blockCount,
        uint256 roundDuration,
        uint256 difficulty,
        uint256 targetInterval
    );

    /// @notice Instantiates a Speed Bump structure
    /// @param _minDifficulty lower bound for difficulty parameter
    /// @param _initialDifficulty starting difficulty
    /// @param _difficultyAdjustmentParameter how quickly the difficulty gets updated
    /// according to the difference between time passed and target interval.
    /// @param _targetInterval how often we want to elect a winner
    /// @param _posManagerAddress address of ProofOfStake that will use this instance
    function instantiate(
        uint256 _minDifficulty,
        uint256 _initialDifficulty,
        uint256 _difficultyAdjustmentParameter,
        uint256 _targetInterval,
        address _posManagerAddress
    ) public returns (uint256)
    {
        require(
            _targetInterval > 30,
            "Target interval has to be bigger than 30 seconds"
        );

        instance[currentIndex].minDifficulty = _minDifficulty;
        instance[currentIndex].difficulty = _initialDifficulty;
        instance[currentIndex].difficultyAdjustmentParameter = _difficultyAdjustmentParameter;
        instance[currentIndex].targetInterval = _targetInterval;
        instance[currentIndex].posManagerAddress = _posManagerAddress;

        instance[currentIndex].currentGoalBlockNumber = block.number + 1; // goal has to be in the future, so miner cant manipulate (easily)
        instance[currentIndex].blockSelectionTimestamp = block.timestamp; // first selection starts when the instance is created

        active[currentIndex] = true;
        return currentIndex++;
    }

    /// @notice Calculates the log of the random number between the goal and callers address
    /// @param _index the index of the instance of block selector you want to interact with
    /// @param _user address to calculate log of random
    /// @return log of random number between goal and callers address * 1M
    function getLogOfRandom(uint256 _index, address _user) internal view returns (uint256) {
        bytes32 currentGoal = blockhash(instance[_index].currentGoalBlockNumber);
        bytes32 hashedAddress = keccak256(abi.encodePacked(_user));
        uint256 distance = uint256(keccak256(abi.encodePacked(hashedAddress, currentGoal)));

        return CartesiMath.log2ApproxTimes1M(distance);
    }

    /// @notice Claim that _user won the round
    /// @param _index the index of the instance of block selector you want to interact with
    /// @param _user address that will win the block selector
    /// @param _weight number that will weight the random number, most likely will be the number of staked tokens
    function claimBlock(uint256 _index, address _user, uint256 _weight) public returns (bool) {
        BlockSelectorCtx storage bsc = instance[_index];

        require(_weight > 0, "Caller must have at least one staked token");
        require(msg.sender == bsc.posManagerAddress, "Function can only be called by pos address");

        if (canClaim(_index, _user, _weight)) {
            emit BlockProduced(
                _index,
                _user,
                bsc.blockCount,
                getMicrosecondsSinceLastDraw(_index),
                bsc.difficulty,
                bsc.targetInterval
            );

            return _blockCreated(_index, _user);
        }

        return false;
    }

    /// @notice Check if address can win current round
    /// @param _index the index of the instance of block selector you want to interact with
    /// @param _user the address that is gonna get checked
    /// @param _weight number that will weight the random number, most likely will be the number of staked tokens
    function canClaim(uint256 _index, address _user, uint256 _weight) public view returns (bool) {
        BlockSelectorCtx storage bsc = instance[_index];

        // cannot win if block selector goal hasnt been decided yet
        if (block.number <= bsc.currentGoalBlockNumber) {
            return false;
        }

        uint256 time = getMicrosecondsSinceLastDraw(_index);

        // cannot get hash of block if its older than 256, we set 220 to avoid edge cases
        // new goal cannot be in the past, otherwise user could "choose it"
        return (
            (block.number).sub(bsc.currentGoalBlockNumber) > 220 ||
            (_weight.mul(time)) > bsc.difficulty.mul((256000000 - getLogOfRandom(_index, _user)))
        );
    }

    /// @notice Block created, declare winner and ajust difficulty
    /// @param _index the index of the instance of block selector you want to interact with
    /// @param _user address of user that won the round
    function _blockCreated(uint256 _index, address _user) private returns (bool) {
        BlockSelectorCtx storage bsc = instance[_index];
        // declare winner
        bsc.blockProducer[bsc.blockCount] = _user;

        // adjust difficulty
        bsc.difficulty = getNewDifficulty(
            bsc.minDifficulty,
            bsc.difficulty,
            (block.timestamp).sub(bsc.blockSelectionTimestamp),
            bsc.targetInterval,
            bsc.difficultyAdjustmentParameter
        );

        _reset(_index);
        return true;
    }

    /// @notice Reset instance, advancing round and choosing new goal
    /// @param _index the index of the instance of block selector you want to interact with
    function _reset(uint256 _index) private {
        BlockSelectorCtx storage bsc = instance[_index];

        bsc.blockCount++;
        bsc.currentGoalBlockNumber = block.number + 1;
        bsc.blockSelectionTimestamp = block.timestamp;
    }

    /// @notice Calculates new difficulty parameter
    /// @param _minDiff minimum difficulty of instance
    /// @param _oldDiff is the difficulty of previous round
    /// @param _timePassed is how long the previous round took
    /// @param _desiredDrawTime is how long a round is supposed to take
    /// @param _adjustmentParam is how fast the difficulty gets adjusted,
    ///         should be number * 1000000
    function getNewDifficulty(
        uint256 _minDiff,
        uint256 _oldDiff,
        uint256 _timePassed,
        uint256 _desiredDrawTime,
        uint256 _adjustmentParam
    )
    internal
    pure
    returns (uint256)
    {
        if (_timePassed < _desiredDrawTime) {
            return _oldDiff.add(_oldDiff.mul(_adjustmentParam).div(1000000) + 1);
        } else if (_timePassed > _desiredDrawTime) {
            uint256 newDiff = _oldDiff.sub(_oldDiff.mul(_adjustmentParam).div(1000000) + 1);

            return newDiff > _minDiff ? newDiff : _minDiff;
        }

        return _oldDiff;
    }

    /// @notice Returns the round count of this instance
    /// @param _index the index of the instance of block selector to be interact with
    /// @return how many rounds have happened
    function getRoundCount(uint256 _index) public view returns (uint256) {
        return instance[_index].blockCount;
    }

    /// @notice Returns current selection time
    /// @param _index the index of the instance of block selector to be interact with
    /// @return timestamp of when current selection was instantiated
    function getCurrentDrawStartTime(uint256 _index) public view returns (uint256) {
        return instance[_index].blockSelectionTimestamp;
    }

    /// @notice Returns current difficulty
    /// @param _index the index of the instance of block selector to be interact with
    /// @return difficulty of current selection
    function getDifficulty(uint256 _index) public view returns (uint256) {
        return instance[_index].difficulty;
    }

    /// @notice Returns min difficulty
    /// @param _index the index of the instance of block selector to be interact with
    /// @return min difficulty of instance
    function getMinDifficulty(uint256 _index) public view returns (uint256) {
        return instance[_index].minDifficulty;
    }

    /// @notice Returns difficulty adjustment parameter
    /// @param _index the index of the instance of block selector to be interact with
    /// @return difficulty adjustment parameter
    function getDifficultyAdjustmentParameter(
        uint256 _index
    )
    public
    view
    returns (uint256)
    {
        return instance[_index].difficultyAdjustmentParameter;
    }

    /// @notice Returns desired selection interval
    /// @param _index the index of the instance of block selector to be interact with
    /// @return desired selection interval of this instance
    function getDesiredDrawInterval(uint256 _index) public view returns (uint256) {
        return instance[_index].targetInterval;
    }

    /// @notice Returns time since last selection started, in microseconds
    /// @param _index the index of the instance of block selector to be interact with
    /// @return microseconds passed since last selection started
    function getMicrosecondsSinceLastDraw(uint256 _index) public view returns (uint256) {
        BlockSelectorCtx storage bsc = instance[_index];

        // time since selection started times 1e6 (microseconds)
        return ((block.timestamp).sub(bsc.blockSelectionTimestamp)).mul(1000000);
    }

    function getState(uint256 _index, address _user)
    public view returns (uint256[5] memory _uintValues) {
        BlockSelectorCtx storage i = instance[_index];

        uint256[5] memory uintValues = [
            block.number,
            i.currentGoalBlockNumber,
            i.difficulty,
            ((block.timestamp).sub(i.blockSelectionTimestamp)).mul(1000000), // time passed
            getLogOfRandom(_index, _user)
        ];

        return uintValues;
    }

    function isConcerned(uint256, address) public override pure returns (bool) {
        return false; // isConcerned is only for the main concern (PoS)
    }

    function getSubInstances(uint256, address)
        public override pure returns (address[] memory _addresses,
            uint256[] memory _indices)
    {
        address[] memory a;
        uint256[] memory i;

        a = new address[](0);
        i = new uint256[](0);

        return (a, i);
    }
}
