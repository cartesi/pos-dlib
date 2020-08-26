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

/// @title Proof of Stake Prototype
/// @author Felipe Argento

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


import "@cartesi/util/contracts/CartesiMath.sol";
import "@cartesi/util/contracts/Instantiator.sol";
import "@cartesi/util/contracts/Decorated.sol";
import "@cartesi/util/contracts/WorkerAuthManager.sol";


import "./Staking.sol";
import "./Lottery.sol";
import "./PrizeManager.sol";

contract PoSPrototype is Ownable, Instantiator, Decorated, CartesiMath {
    using SafeMath for uint256;

    uint256 constant SPLIT_BASE = 10000;

    struct PoSPrototypeCtx {
        mapping (address => address) beneficiaryMap;
        mapping (address => uint256) splitMap;
        uint256 lotteryIndex;
        Lottery lottery;
        Staking staking;
        PrizeManager prizeManager;
        WorkerAuthManager workerAuth;
    }

    mapping(uint256 => PoSPrototypeCtx) internal instance;

    event BeneficiaryUpdated(
        address _user,
        address _beneficiary
    );

    /// @notice Instantiates a Proof of Stake prototype
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
        uint256 _difficultyAdjustmentParameter,
        uint256 _desiredDrawTimeInterval,
        address _prizeManagerAddress
    ) public onlyOwner() returns (uint256)
    {

        instance[currentIndex].staking = Staking(_stakingAddress);
        instance[currentIndex].lottery = Lottery(_lotteryAddress);
        instance[currentIndex].prizeManager = PrizeManager(_prizeManagerAddress);
        instance[currentIndex].workerAuth = WorkerAuthManager(_workerAuthAddress);

        instance[currentIndex].lotteryIndex = instance[currentIndex].lottery.instantiate(
            _difficultyAdjustmentParameter,
            _desiredDrawTimeInterval,
            address(this)
        );

        active[currentIndex] = true;
        return currentIndex++;
    }

    /// @notice Claim that _user won the round
    /// @param _index the index of the instance of posPrototype you want to interact with
    function claimWin(uint256 _index) public returns (bool) {

        PoSPrototypeCtx storage pos = instance[_index];

        require(
            pos.workerAuth.isAuthorized(msg.sender, address(this)),
            "msg.sender is not authorized to make this call"
        );

        address user = pos.workerAuth.getOwner(msg.sender);
        address beneficiary = pos.beneficiaryMap[user];

        uint256 userSplit = pos.splitMap[user];
        uint256 beneficiarySplit = pos.splitMap[beneficiary];

        require(
            userSplit.add(beneficiarySplit) == SPLIT_BASE,
            "Prize splits dont add up to a 100%"
        );

        require(
            pos.lottery.claimRound(pos.lotteryIndex, user, pos.staking.getStakedBalance(user)),
            "User couldnt claim round successfully"
        );

        uint256 currentPrize = pos.prizeManager.getCurrentPrize();

        if (beneficiary == address(0) || userSplit == SPLIT_BASE) {
            pos.prizeManager.payWinner(user, currentPrize);
        } else if (beneficiarySplit == SPLIT_BASE) {
            pos.prizeManager.payWinner(beneficiary, currentPrize);
        } else {
            pos.prizeManager.payWinner(beneficiary, currentPrize.mul(beneficiarySplit).div(SPLIT_BASE));
            pos.prizeManager.payWinner(user, currentPrize.mul(userSplit).div(SPLIT_BASE));
        }

        return true;
    }

    function getState(uint256 _index, address)
    public view returns (bool, address) {
        PoSPrototypeCtx storage pos = instance[_index];

        // translate worker/user address
        address user = pos.workerAuth.getOwner(msg.sender);

        return (pos.lottery.canWin(
            pos.lotteryIndex,
            user,
            pos.staking.getStakedBalance(user)
        ), user);
    }

    function isConcerned(uint256 _index, address) public override view returns (bool) {
        PoSPrototypeCtx storage pos = instance[_index];

        // translate worker/user address
        address user = pos.workerAuth.getOwner(msg.sender);

        return pos.staking.getStakedBalance(user) > 0;
    }

    function getSubInstances(uint256 _index, address)
        public override view returns (address[] memory _addresses,
            uint256[] memory _indices)
    {
        PoSPrototypeCtx storage pos = instance[_index];

        address[] memory a;
        uint256[] memory i;

        a = new address[](1);
        i = new uint256[](1);

        a[0] = address(pos.lottery);
        i[0] = pos.lotteryIndex;
        return (a, i);
    }
}
