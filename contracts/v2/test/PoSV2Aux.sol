// Copyright 2022 Cartesi Pte. Ltd.

// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

/// @title PoSV2 auxiliary contract
/// @author Stephen Chen

pragma solidity ^0.8.0;

import "../PoSV2Impl.sol";

contract PoSV2Aux is PoSV2Impl {
    constructor(
        address _ctsiAddress,
        address _stakingAddress,
        address _workerAuthAddress,
        uint128 _initialDifficulty,
        uint64 _minDifficulty,
        uint32 _difficultyAdjustmentParameter,
        uint32 _targetInterval,
        uint256 _rewardValue,
        uint32 _rewardDelay,
        uint32 _version
    )
        PoSV2Impl(
            _ctsiAddress,
            _stakingAddress,
            _workerAuthAddress,
            _initialDifficulty,
            _minDifficulty,
            _difficultyAdjustmentParameter,
            _targetInterval,
            _rewardValue,
            _rewardDelay,
            _version
        )
    {}

    function _produceBlockGas() public returns (address) {
        require(
            workerAuth.isAuthorized(msg.sender, address(this)),
            "msg.sender is not authorized"
        );

        address user = workerAuth.getOwner(msg.sender);
        uint256 ethBlockStamp = historicalCtx.latestCtx.ethBlockStamp;

        require(
            EligibilityCalImpl.canProduceBlock(
                difficulty,
                uint32(ethBlockStamp),
                user,
                staking.getStakedBalance(user)
            ),
            "User couldnt produce a block"
        );

        DifficultyManagerImpl.adjustDifficulty(block.number - ethBlockStamp);

        return user;
    }

    // intentionally make it a transaction to reflect gas cost in hardhat gas report
    function canProduceBlockGas(
        uint128 d,
        uint32 e,
        address u,
        uint256 b
    ) public returns (bool) {
        return EligibilityCalImpl.canProduceBlock(d, e, u, b);
    }

    function canProduceBlockView(
        uint128 d,
        uint32 e,
        address u,
        uint256 b
    ) public view returns (bool) {
        return EligibilityCalImpl.canProduceBlock(d, e, u, b);
    }

    function adjustDifficultyGas(uint256 b) public {
        DifficultyManagerImpl.adjustDifficulty(b);
    }

    function recordBlockGas(uint32 p, bytes calldata d) public {
        HistoricalDataImpl.recordBlock(
            p,
            msg.sender,
            keccak256(abi.encodePacked(d))
        );
    }

    function getEligibilityInfo()
        public
        view
        returns (
            uint256,
            uint32,
            address,
            uint256
        )
    {
        address user = workerAuth.getOwner(msg.sender);

        return (
            difficulty,
            historicalCtx.latestCtx.ethBlockStamp,
            user,
            staking.getStakedBalance(user)
        );
    }
}
