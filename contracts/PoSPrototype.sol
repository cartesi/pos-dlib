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


import "./StakingInterface.sol";
import "./Lottery.sol";
import "./PrizeManager.sol";

contract PoSPrototype is Ownable, Instantiator, Decorated, CartesiMath{
    using SafeMath for uint256;

    struct PoSPrototypeCtx {
        mapping(address => address) getProxy; // staker => proxy
        mapping(address => address) getStaker; // proxy => staker

        uint256 lotteryIndex;
        Lottery lottery;
        StakingInterface staking;
    }

    mapping(uint256 => PoSPrototypeCtx) internal instance;

    event ProxyAdded(
        address _from,
        address _to,
        uint256 _amountOfTokens
    );

    /// @notice Instantiates a Proof of Stake prototype
    /// @param _stakingAddress address of StakingInterface
    /// @param _lotteryAddress address of lottery contract
    /// @param _difficultyAdjustmentParameter how quickly the difficulty gets updated
    /// according to the difference between time passed and desired draw time interval.
    /// @param _desiredDrawTimeInterval how often we want to elect a winner
    /// @param _prizeManagerAddress address containing the tokens that will be distributed
    function instantiate(
        address _stakingAddress,
        address _lotteryAddress,
        uint256 _difficultyAdjustmentParameter,
        uint256 _desiredDrawTimeInterval,
        address _prizeManagerAddress
    ) public onlyOwner() returns (uint256)
    {

        instance[currentIndex].staking = StakingInterface(_stakingAddress);
        instance[currentIndex].lottery = Lottery(_lotteryAddress);

        instance[currentIndex].lotteryIndex = instance[currentIndex].lottery.instantiate(
            _difficultyAdjustmentParameter,
            _desiredDrawTimeInterval,
            _prizeManagerAddress,
            address(this)
        );

        active[currentIndex] = true;
        return currentIndex++;
    }

    /// @notice Claim that _user won the round
    /// @param _index the index of the instance of posPrototype you want to interact with
    /// @param _user address that will win the lottery
    function claimWin(uint256 _index, address _user) public returns (bool) {
        PoSPrototypeCtx storage pos = instance[_index];

        return pos.lottery.claimRound(pos.lotteryIndex, _user, pos.staking.getStakedBalance(0, _user));
    }

    /// @notice Add address that can represent msg.sender at the Lottery
    /// @param _index the index of the instance of posPrototype you want to interact with
    /// @param _proxyAddress the address of the proxy that can represent msg.sender
    function addProxy(uint256 _index, address _proxyAddress) public {
        PoSPrototypeCtx storage pos = instance[_index];

        pos.getProxy[msg.sender] = _proxyAddress;

        emit ProxyAdded(
            msg.sender,
            _proxyAddress,
            pos.staking.getStakedBalance(0, msg.sender)
        );
    }

    /// @notice Accepts a address as a staker
    /// @param _index the index of the instance of posPrototype you want to interact with
    /// @param _stakerAddress the address of the staker that is being accepted
    function acceptStaker(uint256 _index, address _stakerAddress) public {
        PoSPrototypeCtx storage pos = instance[_index];

        require(pos.getProxy[_stakerAddress] == msg.sender, "Proxy was not previously added");
        pos.getStaker[msg.sender] = _stakerAddress;
    }

    function getState(uint256 _index, address _user)
    public view returns (bool, address) {
        PoSPrototypeCtx storage pos = instance[_index];

        // if address is proxy, check if represented staker can win
        if (pos.getStaker[_user] != address(0)) {
            return (pos.lottery.canWin(
                pos.lotteryIndex,
                pos.getStaker[_user],
                pos.staking.getStakedBalance(0, pos.getStaker[_user])
            ), pos.getStaker[_user]);
        }
        // else address is staker
        return (pos.lottery.canWin(
            pos.lotteryIndex,
            _user,
            pos.staking.getStakedBalance(0, _user)
        ), _user);
    }

    function isConcerned(uint256 _index, address _user) public override view returns (bool) {
        PoSPrototypeCtx storage pos = instance[_index];

        // user is concerned if he has staked tokens
        // or
        // if he is the proxy of someone with tokens
        return pos.staking.getStakedBalance(0, _user) > 0 || pos.staking.getStakedBalance(0, pos.getStaker[_user]) > 0;
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
