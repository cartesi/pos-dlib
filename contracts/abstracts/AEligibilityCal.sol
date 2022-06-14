// Copyright 2022 Cartesi Pte. Ltd.

// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

/// @title Abstract Eligibility Calculator

pragma solidity ^0.8.0;

abstract contract AEligibilityCal {
    /// @notice Check if _user is allowed to produce a sidechain block
    /// @param _ethBlockStamp ethereum block number when current selection started
    /// @param _difficulty ethereum block number when current selection started
    /// @param _user the address that is gonna get checked
    /// @param _weight number that will weight the random number, most likely will be the number of staked tokens
    function canProduceBlock(
        uint64 _difficulty,
        uint32 _ethBlockStamp,
        address _user,
        uint256 _weight
    ) public view virtual returns (bool);

    /// @notice Get when _user is allowed to produce a sidechain block
    /// @param _ethBlockStamp ethereum block number when current selection started
    /// @param _difficulty ethereum block number when current selection started
    /// @param _user the address that is gonna get checked
    /// @param _weight number that will weight the random number, most likely will be the number of staked tokens
    /// @return uint256 mainchain block number when the user can produce a sidechain block
    function whenCanProduceBlock(
        uint64 _difficulty,
        uint32 _ethBlockStamp,
        address _user,
        uint256 _weight
    ) public view virtual returns (uint256);
}
