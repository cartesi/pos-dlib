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


/// @title Cartesi Staking
/// @author Felipe Argento
pragma solidity ^0.5.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./StakingInterface.sol";

contract Staking is StakingInterface {
    using SafeMath for uint256;
    IERC20 private ctsi;

    struct StakingCtx {
        uint256 timeToStake; // time it takes for deposited tokens to become staked.
        uint256 timeToWithdraw; // time it takes from witdraw signal to tokens to be unlocked.

        uint256 lastReleaseDate; // time when last ieo fund is unlocked.

        mapping(address => uint256) stakedBalance; // the amount of money currently being staked.
        mapping(address => MaturationStruct) toBeStakedList; // deposits that are waiting to be old enough to become staked.
        mapping(address => MaturationStruct) toWithdrawList; // money that is waiting to be withdrew.
        mapping(address => ieoStruct) ieoFrozenFunds; // funds that were frozen during token launch, they will count as stake.
    }

    mapping(uint256 => StakingCtx) internal instance;

    // TODO: Add vesting contracts
    struct ieoStruct {
        uint256[] amount; // the amount of money that was locked during token creation
        uint256[] releaseDate; // when those tokens are to be released
    }

    struct MaturationStruct {
        uint256[] amount;
        uint256[] time;
        uint256 nextSearchIndex; // used to implement FIFO
    }

    constructor(address _ctsiAddress) public {
        ctsi = IERC20(_ctsiAddress);

        //TODO: Review values
        instantiate(5 days, 5 days, 1760054400);
    }

    /// @notice Instantiate a Staking struct.
    /// @param _timeToStake time it takes for deposited tokens to become staked.
    /// @param _timeToWithdraw time it takes from witdraw signal to tokens to be unlocked.
    /// @param _lastReleaseDate time when last ieo fund is unlocked..
    /// @return Staking index.
    function instantiate(uint256 _timeToStake, uint256 _timeToWithdraw, uint256 _lastReleaseDate) private returns (uint256) {
        StakingCtx storage currentInstance = instance[currentIndex];

        currentInstance.timeToStake = _timeToStake;
        currentInstance.timeToWithdraw = _timeToWithdraw;
        currentInstance.lastReleaseDate = _lastReleaseDate;

        active[currentIndex];
        return currentIndex++;
    }

    /// @notice Deposit CTSI to be staked. The money will turn into staked balance after timeToStake days, if the function finalizeStakes is called.
    /// @param _index index of staking that youre interacting with
    /// @param _amount The amount of tokens that are gonna be deposited.
    function depositStake(uint256 _index, uint256 _amount) public {
        // transfer stake to contract
        // from: msg.sender
        // to: this contract
        // value: _amount
        ctsi.transferFrom(msg.sender, address(this), _amount);

        StakingCtx storage ins = instance[_index];

        ins.toBeStakedList[msg.sender].amount.push(_amount);
        ins.toBeStakedList[msg.sender].time.push(now);
    }

    /// @notice Finalizes Stakes. Goes through the list toBeStaked and transform that into staked balance, if the requirements are met.
    /// @param _index index of staking that youre interacting with
    /// @dev The number of stakes finalized is limited to 50 in order to avoid a deadlock in the contract - when the list is big enough so that the iteration doesnt fit the gas limit.
    function finalizeStakes(uint256 _index) public {
        StakingCtx storage ins = instance[_index];
        MaturationStruct memory TBSL = ins.toBeStakedList[msg.sender];

        for (uint256 i = TBSL.nextSearchIndex; (i < TBSL.amount.length) && (i < TBSL.nextSearchIndex.add(50)); i++){
            if (now > TBSL.time[i].add(ins.timeToStake)) {
                ins.stakedBalance[msg.sender] = ins.stakedBalance[msg.sender].add(TBSL.amount[i]);

                ins.toBeStakedList[msg.sender].nextSearchIndex = i + 1;
                delete ins.toBeStakedList[msg.sender].amount[i];
                delete ins.toBeStakedList[msg.sender].time[i];
            } else {
                break; // if finds a deposit that is not ready, all deposits after that wont be ready
            }
        }
    }

    /// @notice Start CTSI withdraw from staked balance process. The money will turn into withdrawal balance after timeToWithdraw days, if the function finalizeWithdraw is called.
    /// @param _index index of staking that youre interacting with
    /// @param _amount The amount of tokens that are gonna be withdrew.
    function startWithdraw(uint256 _index, uint256 _amount) public {
        StakingCtx storage ins = instance[_index];

        ins.stakedBalance[msg.sender] = ins.stakedBalance[msg.sender].sub(_amount);

        ins.toWithdrawList[msg.sender].amount.push(_amount);
        ins.toWithdrawList[msg.sender].time.push(now);
    }

    /// @notice Finalizes withdraws. Goes through the list toWithdraw and removes that from staked balance, if the requirements are met.
    /// @param _index index of staking that youre interacting with
    /// @dev The number of withdraws finalized is limited to 50 in order to avoid a deadlock in the contract - when the list is big enough so that the iteration doesnt fit the gas limit.
    function finalizeWithdraws(uint256 _index) public {
        uint256 totalWithdraw = 0;
        StakingCtx storage ins = instance[_index];
        MaturationStruct memory TBWL = ins.toWithdrawList[msg.sender];

        for (uint256 i = TBWL.nextSearchIndex; (i < TBWL.amount.length) && (i < TBWL.nextSearchIndex.add(50)); i++){
            if (now > TBWL.time[i].add(ins.timeToWithdraw)) {
                ins.toWithdrawList[msg.sender].nextSearchIndex = i + 1;
                totalWithdraw = totalWithdraw.add(TBWL.amount[i]);

                delete ins.toWithdrawList[msg.sender].amount[i];
                delete ins.toWithdrawList[msg.sender].time[i];
            } else {
                break;
            }
        }
        if (totalWithdraw != 0) {
            // withdraw tokens
            // from: this contract
            // to: msg.sender
            // value: bet total withdraw value on toWithdrawList
            ctsi.transfer(msg.sender, totalWithdraw);
        }
    }

    /// @notice Returns total amount of tokens counted as stake
    /// @param _index index of staking that youre interacting with
    /// @param _userAddress user to retrieve staked balance from
    function getStakedBalance(uint256 _index, address _userAddress) public view returns (uint256) {
        StakingCtx storage ins = instance[_index];
        uint256 totalAmount = ins.stakedBalance[_userAddress];

        if (now > ins.lastReleaseDate) {
            return totalAmount;
        }

        ieoStruct memory IFF = ins.ieoFrozenFunds[_userAddress];
        for (uint256 i = 0; i < IFF.amount.length; i++) {
            if (IFF.releaseDate[i] > now) {
                totalAmount = totalAmount.add(IFF.amount[i]);
            }
        }

        return totalAmount;
    }

    function getState(uint256 _index, address _user) public view returns
        ( uint256[4] memory _uintValues
        ) {
            StakingCtx memory ins = instance[_index];
            uint256[4] memory uintValues = [
                ins.timeToStake,
                ins.timeToWithdraw,
                ins.lastReleaseDate,
                instance[_index].stakedBalance[_user]
            ];

            return uintValues;
    }

    // TODO: Add speedbump as subinstance
    function getSubInstances(uint256, address)
        public view returns (address[] memory _addresses,
            uint256[] memory _indices)
    {
        address[] memory a;
        uint256[] memory i;

        a = new address[](0);
        i = new uint256[](0);
        return (a, i);
    }

}
