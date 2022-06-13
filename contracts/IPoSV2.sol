// Copyright 2022 Cartesi Pte. Ltd.

// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

/// @title Interface PoSV2

pragma solidity >=0.7.0 <0.9.0;

interface IPoSV2 {
    event NewChain(
        address ctsiAddress,
        address stakingAddress,
        address workerAuthAddress,
        uint64 minDifficulty,
        uint64 initialDifficulty,
        uint32 difficultyAdjustmentParameter,
        uint32 targetInterval,
        uint256 rewardValue,
        uint32 rewardDelay
    );

    event BlockProduced(
        address indexed user,
        address indexed worker,
        uint32 sidechainBlockNumber,
        uint32 mainchainBlockNumber,
        bytes data
    );

    // legacy methods from V1 chains for staking pool V1 compatibility
    // perhaps hack the uint256 value to smuggle parent/data for V2 block production

    /// @notice Produce a block in V1 chains
    /// @dev this function can only be called by a worker, user never calls it directly
    function produceBlock(uint256) external returns (bool);

    /// @notice Get reward manager address
    /// @return address of instance's RewardManager
    function getRewardManagerAddress(uint256) external view returns (address);

    // methods for V2 chains

    /// @notice Produce a block in V2 chains
    /// @param _parent the parent block that current block appends to
    /// @param _data the data to store in the block
    /// @dev this function can only be called by a worker, user never calls it directly
    function produceBlock2(uint32 _parent, bytes calldata _data)
        external
        returns (bool);

    function terminate() external;
}
