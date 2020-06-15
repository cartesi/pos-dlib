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

import "@cartesi/util/contracts/CartesiMath.sol";
import "@cartesi/util/contracts/Instantiator.sol";
import "@cartesi/util/contracts/Decorated.sol";


import "./StakingInterface.sol";
import "./Lottery.sol";
import "./PrizeManager.sol";

contract PoSPrototype is Instantiator, Decorated, CartesiMath{
    using SafeMath for uint256;

    struct PoSPrototypeCtx {
        mapping(address => address) proxyMap; // staker => proxy
        mapping(address => address) stakerMap; // proxy => staker

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
    function instantiate(
        address _stakingAddress,
        address _lotteryAddress,
        uint256 _difficultyAdjustmentParameter,
        uint256 _desiredDrawTimeInterval,
        address _prizeManagerAddress
    ) public returns (uint256)
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

    function claimWin(uint256 _index, address _user) public returns (bool) {
        PoSPrototypeCtx storage pos = instance[_index];

        return pos.lottery.claimRound(pos.lotteryIndex, _user, pos.staking.getStakedBalance(0, _user));
    }

    function addProxy(uint256 _index, address _proxyAddress) public {
        PoSPrototypeCtx storage pos = instance[_index];

        pos.proxyMap[msg.sender] = _proxyAddress;

        emit ProxyAdded(
            msg.sender,
            _proxyAddress,
            pos.staking.getStakedBalance(0, msg.sender)
        );
    }

    function acceptStaker(uint256 _index, address _stakerAddress) public {
        PoSPrototypeCtx storage pos = instance[_index];

        require(pos.proxyMap[_stakerAddress] == msg.sender, "Proxy was not previously added");
        pos.stakerMap[msg.sender] = _stakerAddress;
    }

    function getState(uint256 _index, address _user)
    public view returns (bool) {
        PoSPrototypeCtx storage pos = instance[_index];

        // if address is proxy, check if represented staker can win
        if (pos.stakerMap[_user] != address(0)) {
            return pos.lottery.canWin(
                pos.lotteryIndex,
                pos.stakerMap[_user],
                pos.staking.getStakedBalance(0, pos.stakerMap[_user])
            );
        }
        // else address is staker
        return pos.lottery.canWin(
            pos.lotteryIndex,
            _user,
            pos.staking.getStakedBalance(0, _user)
        );
    }

    function isConcerned(uint256 _index, address _user) public override view returns (bool) {
        PoSPrototypeCtx storage pos = instance[_index];

        // user is concerned if he has staked tokens
        // or
        // if he is the proxy of someone with tokens
        return pos.staking.getStakedBalance(0, _user) > 0 || pos.staking.getStakedBalance(0, pos.stakerMap[_user]) > 0;
    }

    function getSubInstances(uint256 _index, address)
        public override view returns (address[] memory _addresses,
            uint256[] memory _indices)
    {
        address[] memory a;
        uint256[] memory i;

        a = new address[](1);
        i = new uint256[](1);

        return (a, i);
    }
}
