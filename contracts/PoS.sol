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

/// @title Proof of Stake
/// @author Felipe Argento

pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "@cartesi/util/contracts/InstantiatorImpl.sol";
import "@cartesi/util/contracts/Decorated.sol";
import "@cartesi/util/contracts/WorkerAuthManager.sol";

import "./Staking.sol";
import "./Lottery.sol";
import "./PrizeManager.sol";

contract PoS is Ownable, InstantiatorImpl, Decorated {
    using SafeMath for uint256;

    uint256 constant SPLIT_BASE = 10000;

    struct PoSCtx {
        mapping(address => address) beneficiaryMap;
        mapping(address => uint256) splitMap;
        uint256 lotteryIndex;
        Lottery lottery;
        Staking staking;
        PrizeManager prizeManager;
        WorkerAuthManager workerAuth;
    }

    mapping(uint256 => PoSCtx) internal instance;

    event PrizePaid(
        uint256 indexed index,
        address indexed worker,
        address indexed user,
        address beneficiary,
        uint256 userPrize,
        uint256 beneficiaryPrize
    );

    event BeneficiaryAdded(
        uint256 indexed index,
        address indexed user,
        address indexed beneficiary,
        uint256 split
    );

    function addBeneficiary(
        uint256 _index,
        address _beneficiary,
        uint256 _split
    ) public {
        PoSCtx storage pos = instance[_index];

        require(_split <= SPLIT_BASE, "split has to be less than 100%");

        pos.beneficiaryMap[msg.sender] = _beneficiary;
        pos.splitMap[msg.sender] = SPLIT_BASE.sub(_split);

        emit BeneficiaryAdded(_index, msg.sender, _beneficiary, _split);
    }

    /// @notice Instantiates a Proof of Stake
    /// @param _stakingAddress address of StakingInterface
    /// @param _lotteryAddress address of lottery contract
    /// @param _workerAuthAddress address of worker manager contract
    /// @param _difficultyAdjustmentParameter how quickly the difficulty gets updated
    /// according to the difference between time passed and desired draw time interval.
    /// @param _desiredDrawTimeInterval how often we want to elect a winner
    /// @param _prizeManagerAddress address containing the tokens that will be distributed
    function instantiate(
        address _stakingAddress,
        address _lotteryAddress,
        address _workerAuthAddress,
        uint256 _minimumDifficulty,
        uint256 _initialDifficulty,
        uint256 _difficultyAdjustmentParameter,
        uint256 _desiredDrawTimeInterval,
        address _prizeManagerAddress
    ) public onlyOwner() returns (uint256) {
        instance[currentIndex].staking = Staking(_stakingAddress);
        instance[currentIndex].lottery = Lottery(_lotteryAddress);
        instance[currentIndex].prizeManager = PrizeManager(
            _prizeManagerAddress
        );
        instance[currentIndex].workerAuth = WorkerAuthManager(
            _workerAuthAddress
        );

        instance[currentIndex].lotteryIndex = instance[currentIndex]
            .lottery
            .instantiate(
            _minimumDifficulty,
            _initialDifficulty,
            _difficultyAdjustmentParameter,
            _desiredDrawTimeInterval,
            address(this)
        );

        active[currentIndex] = true;
        return currentIndex++;
    }

    /// @notice Claim that _user won the round
    /// @param _index the index of the instance of pos you want to interact with
    /// @dev this function can only be called by a worker, user never calls it directly
    function claimWin(uint256 _index) public returns (bool) {
        PoSCtx storage pos = instance[_index];

        require(
            pos.workerAuth.isAuthorized(msg.sender, address(this)),
            "msg.sender is not authorized to make this call"
        );

        address user = pos.workerAuth.getOwner(msg.sender);
        address beneficiary = pos.beneficiaryMap[user];

        uint256 userSplit = pos.splitMap[user];
        uint256 beneficiarySplit = SPLIT_BASE.sub(userSplit);

        require(
            pos.lottery.claimRound(
                pos.lotteryIndex,
                user,
                pos.staking.getStakedBalance(user)
            ),
            "User couldnt claim round successfully"
        );

        uint256 currentPrize = pos.prizeManager.getCurrentPrize();

        if (beneficiary == address(0) || userSplit == SPLIT_BASE) {
            pos.prizeManager.payWinner(user, currentPrize);
            emit PrizePaid(
                _index,
                msg.sender,
                user,
                beneficiary,
                currentPrize,
                0
            );
        } else if (beneficiarySplit == SPLIT_BASE) {
            pos.prizeManager.payWinner(beneficiary, currentPrize);
            emit PrizePaid(
                _index,
                msg.sender,
                user,
                beneficiary,
                0,
                currentPrize
            );
        } else {
            uint256 bSplit = currentPrize.mul(beneficiarySplit).div(SPLIT_BASE);
            uint256 uSplit = SPLIT_BASE.sub(bSplit);

            pos.prizeManager.payWinner(beneficiary, bSplit);
            pos.prizeManager.payWinner(user, uSplit);
            emit PrizePaid(
                _index,
                msg.sender,
                user,
                beneficiary,
                uSplit,
                bSplit
            );
        }

        return true;
    }

    /// @notice Get state of a particular instance
    /// @param _index index of instance
    /// @param _user address of user
    /// @return bool if user is eligible to produce next block
    /// @return address of user that was chosen to build the block
    /// @return current prize paid by the network for that block
    /// @return percentage of prize that goes to the user
    function getState(uint256 _index, address _user)
        public
        view
        returns (
            bool,
            address,
            uint256,
            uint256
        )
    {
        PoSCtx storage pos = instance[_index];
        return (
            pos.lottery.canWin(
                pos.lotteryIndex,
                _user,
                pos.staking.getStakedBalance(_user)
            ),
            _user,
            pos.prizeManager.getCurrentPrize(),
            pos.splitMap[_user]
        );
    }

    function isConcerned(uint256 _index, address _user)
        public
        override
        view
        returns (bool)
    {
        PoSCtx storage pos = instance[_index];
        return pos.staking.getStakedBalance(_user) > 0;
    }

    function getSubInstances(uint256 _index, address)
        public
        override
        view
        returns (address[] memory _addresses, uint256[] memory _indices)
    {
        PoSCtx storage pos = instance[_index];

        address[] memory a;
        uint256[] memory i;

        a = new address[](1);
        i = new uint256[](1);

        a[0] = address(pos.lottery);
        i[0] = pos.lotteryIndex;
        return (a, i);
    }
}
