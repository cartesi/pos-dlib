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

contract Staking {
    using SafeMath for uint256;
    IERC20 private ctsi;

    uint256 constant TIME_TO_STAKE = 5 days; // time it takes for deposited tokens to become staked.
    uint256 constant TIME_TO_WITHDRAW = 5 days; // time it takes from witdraw signal to tokens to be unlocked.

    //TODO: Set correct value for last_release_date
    uint256 constant LAST_RELEASE_DATE = 1760054400; // time when last ieo fund is unlocked.

    mapping(address => uint256) internal stakedBalance; // the amount of money currently being staked.
    mapping(address => StakeStruct) internal toBeStakedList; // deposits that are waiting to be old enough to become staked.
    mapping(address => StakeStruct) internal toWithdrawList; // money that is waiting to be withdrew.
    mapping(address => ieoStruct) internal ieoFrozenFunds; // funds that were frozen during token launch, they will count as stake.

    struct ieoStruct {
        uint256[] amount; // the amount of money that was locked during token creation
        uint256[] releaseDate; // when those tokens are to be released
        uint256 count;
    }

    struct StakeStruct {
        uint256[] amount;
        uint256[] date;
        uint256 count;
        uint256 lastSearchIndex;
    }

    constructor(address _ctsiAddress) public {
        ctsi = IERC20(_ctsiAddress);
    }

    /// @notice Deposit CTSI to be staked. The money will turn into staked balance after TIME_TO_STAKE days, if the function finalizeStakes is called.
    /// @param _amount The amount of tokens that are gonna be deposited.
    function depositStake(uint256 _amount) public {
        // transfer stake to contract
        // from: msg.sender
        // to: this contract
        // value: _amount
        ctsi.transferFrom(msg.sender, address(this), _amount);

        toBeStakedList[msg.sender].amount.push(_amount);
        toBeStakedList[msg.sender].date.push(now);
        toBeStakedList[msg.sender].count++;
    }

    /// @notice Finalizes Stakes. Goes through the list toBeStaked and transform that into staked balance, if the requirements are met.
    /// @dev The number of stakes finalized is limited to 50 in order to avoid a deadlock in the contract - when the list is big enough so that the iteration doesnt fit the gas limit.
    function finalizeStakes() public {
        StakeStruct memory TBSL = toBeStakedList[msg.sender];

        for (uint256 i = TBSL.lastSearchIndex; (i < TBSL.count) || (i > TBSL.lastSearchIndex + 50); i++){
            if (now > TBSL.date[i] + TIME_TO_STAKE) {
                stakedBalance[msg.sender] = stakedBalance[msg.sender].add(TBSL.amount[i]);

                toBeStakedList[msg.sender].lastSearchIndex = i;
                delete toBeStakedList[msg.sender].amount[i];
                delete toBeStakedList[msg.sender].date[i];
            }
        }
    }

    /// @notice Start CTSI withdraw from staked balance process. The money will turn into withdrawal balance after TIME_TO_WITHDRAW days, if the function finalizeWithdraw is called.
    /// @param _amount The amount of tokens that are gonna be withdrew.
    function startWithdraw(uint256 _amount) public {
        toWithdrawList[msg.sender].amount.push(_amount);
        toWithdrawList[msg.sender].date.push(now);
        toWithdrawList[msg.sender].count++;
    }

    /// @notice Finalizes withdraws. Goes through the list toWithdraw and removes that from staked balance, if the requirements are met.
    /// @dev The number of withdraws finalized is limited to 50 in order to avoid a deadlock in the contract - when the list is big enough so that the iteration doesnt fit the gas limit.
    function finalizeWithdraws() public {
        StakeStruct memory TBWL = toWithdrawList[msg.sender];
        uint256 totalWithdraw = 0;

        for (uint256 i = TBWL.lastSearchIndex; (i < TBWL.count) || (i > TBWL.lastSearchIndex + 50); i++){
            if (now > TBWL.date[i] + TIME_TO_WITHDRAW) {
                stakedBalance[msg.sender] = stakedBalance[msg.sender].sub(TBWL.amount[i]);
                toWithdrawList[msg.sender].lastSearchIndex = i;

                totalWithdraw = totalWithdraw.add(TBWL.amount[i]);

                delete toWithdrawList[msg.sender].amount[i];
                delete toWithdrawList[msg.sender].date[i];
            }
            // withdraw tokens
            // from: this contract
            // to: msg.sender
            // value: bet total withdraw value on toWithdrawList
            ctsi.transfer(msg.sender, totalWithdraw);
        }
    }

    /// @notice Returns total amount of tokens counted as stake
    /// @param _userAddress user to retrieve staked balance from
    function getStakedBalance(address _userAddress) public view returns (uint256) {
        uint256 totalAmount = stakedBalance[_userAddress];

        if (now > LAST_RELEASE_DATE) {
            return totalAmount;
        }

        ieoStruct memory IFF = ieoFrozenFunds[_userAddress];
        for (uint256 i = 0; i < IFF.count; i++) {
            if (IFF.releaseDate[i] > now) {
                totalAmount = totalAmount.add(IFF.amount[i]);
            }
        }

        return totalAmount;
    }
}
