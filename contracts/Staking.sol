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
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./StakingInterface.sol";

contract Staking is StakingInterface {
    using SafeMath for uint256;
    IERC20 private ctsi;

    uint256 timeToStake; // time it takes for deposited tokens to become staked.
    uint256 timeToWithdraw; // time it takes from witdraw signal to tokens to be unlocked.

    mapping(address => uint256) stakedBalance; // amount of money being staked.
    mapping(address => MaturationStruct) toBeStakedList; // deposits waiting to be staked.
    mapping(address => MaturationStruct) toWithdrawList; // money waiting for withdraw.

    struct MaturationStruct {
        uint256[] amount;
        uint256[] time;
        uint256 nextSearchIndex; // used to implement FIFO
    }

    /// @notice constructor
    /// @param _ctsiAddress address of compatible ERC20
    /// @param _timeToStake time it takes for deposited tokens to become staked.
    /// @param _timeToWithdraw time it takes from witdraw to tokens being unlocked.
    constructor(
        address _ctsiAddress,
        uint256 _timeToStake,
        uint256 _timeToWithdraw
    ) public {
        ctsi = IERC20(_ctsiAddress);
        timeToStake = _timeToStake;
        timeToWithdraw = _timeToWithdraw;
    }

    /// @notice Deposit CTSI to be staked. The money will turn into staked
    //          balance after timeToStake days, if the function finalizeStakes
    //          is called.
    /// @param _amount The amount of tokens that are gonna be deposited.
    function depositStake(uint256 _amount) public {
        // transfer stake to contract
        // from: msg.sender
        // to: this contract
        // value: _amount
        ctsi.transferFrom(msg.sender, address(this), _amount);

        toBeStakedList[msg.sender].amount.push(_amount);
        toBeStakedList[msg.sender].time.push(block.timestamp);

        emit StakeDeposited(_amount, msg.sender, block.timestamp + timeToStake);
    }

    /// @notice Finalizes Stakes. Goes through the list toBeStaked and transform
    //          that into staked balance, if the requirements are met.
    /// @dev The number of stakes finalized is limited to 50 in order to avoid
    //       a deadlock in the contract - when the list is big enough so that
    //       the iteration doesnt fit the gas limit.
    function finalizeStakes() public {
        MaturationStruct storage TBSL = toBeStakedList[msg.sender];

        uint256 totalFinalized = 0;

        for (
            uint256 i = TBSL.nextSearchIndex;
            (i < TBSL.amount.length) && (i < TBSL.nextSearchIndex.add(50));
            i++
        ) {
            if (block.timestamp > TBSL.time[i].add(timeToStake)) {
                totalFinalized = totalFinalized.add(TBSL.amount[i]);

                toBeStakedList[msg.sender].nextSearchIndex = i + 1;
                delete toBeStakedList[msg.sender].amount[i];
                delete toBeStakedList[msg.sender].time[i];
            } else {
                break; // if a deposit is not ready, deposits after that arent ready
            }
        }
        if (totalFinalized != 0) {
            stakedBalance[msg.sender] = stakedBalance[msg.sender].add(totalFinalized);
            emit StakeFinalized(stakedBalance[msg.sender], msg.sender);
        }
    }

    /// @notice Start CTSI withdraw from staked balance process. The money will
    //          turn into withdrawal balance after timeToWithdraw days, if the
    //          function finalizeWithdraw is called.
    /// @param _amount The amount of tokens that are gonna be withdrew.
    function startWithdraw(uint256 _amount) public {
        stakedBalance[msg.sender] = stakedBalance[msg.sender].sub(_amount);

        toWithdrawList[msg.sender].amount.push(_amount);
        toWithdrawList[msg.sender].time.push(block.timestamp);

        emit WithdrawStarted(_amount, msg.sender, block.timestamp + timeToStake);
    }

    /// @notice Finalizes withdraws. Goes through the list toWithdraw and removes
    //          that from staked balance, if the requirements are met.
    /// @dev The number of withdraws finalized is limited to 50 in order to
    //       avoid a deadlock in the contract - when the list is big enough so
    //       that the iteration doesnt fit the gas limit.
    function finalizeWithdraws() public {
        uint256 totalWithdraw = 0;
        MaturationStruct storage TBWL = toWithdrawList[msg.sender];

        for (
            uint256 i = TBWL.nextSearchIndex;
            (i < TBWL.amount.length) && (i < TBWL.nextSearchIndex.add(50));
            i++
        ) {
            if (block.timestamp > TBWL.time[i].add(timeToWithdraw)) {
                toWithdrawList[msg.sender].nextSearchIndex = i + 1;
                totalWithdraw = totalWithdraw.add(TBWL.amount[i]);

                delete toWithdrawList[msg.sender].amount[i];
                delete toWithdrawList[msg.sender].time[i];
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
            emit WithdrawFinalized(totalWithdraw, msg.sender);
        }
    }

    /// @notice Returns total amount of tokens counted as stake
    /// @param _userAddress user to retrieve staked balance from
    function getStakedBalance(address _userAddress)
    public
    view override
    returns (uint256) {
        return stakedBalance[_userAddress];
    }
}
