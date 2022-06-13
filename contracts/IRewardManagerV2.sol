// Copyright 2022 Cartesi Pte. Ltd.

// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

/// @title Abstract RewardManager

pragma solidity >=0.7.0 <0.9.0;

interface IRewardManagerV2 {
    event Rewarded(uint32 indexed sidechainBlockNumber, uint256 reward);

    /// @notice Rewards sidechain block producer
    /// @param _sidechainBlockNumber block of the producer to be rewarded
    function reward(uint32 _sidechainBlockNumber) external;

    /// @notice Get RewardManager's balance
    function getBalance() external view returns (uint256);

    /// @notice Get current reward amount
    function getCurrentReward() external view returns (uint256);
}
