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

use super::dispatcher::{Archive, DApp, Reaction};
use super::dispatcher::{AddressField, BoolField, U256Field};
use super::error::Result;
use super::error::*;
use super::ethabi::Token;
use super::ethereum_types::{U256, Address};
use super::transaction;
use super::transaction::TransactionRequest;

pub struct PoS();

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// these two structs and the From trait below should be
// obtained from a simple derive
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
#[derive(Serialize, Deserialize)]
pub struct PoSCtxParsed(
    pub BoolField, //canWin
    pub AddressField, //winnerAddress
    pub U256Field, //currentPrize
    pub U256Field, //user split
);

#[derive(Serialize, Debug)]
pub struct PoSCtx {
    pub can_win: bool,
    pub winner_address: Address,
    pub current_prize: U256,
    pub user_split: U256,
}

impl From<PoSCtxParsed> for PoSCtx {
    fn from(parsed: PoSCtxParsed) -> PoSCtx {
        PoSCtx {
            can_win: parsed.0.value,
            winner_address: parsed.1.value,
            current_prize: parsed.2.value,
            user_split: parsed.3.value,
        }
    }
}

impl DApp<()> for PoS {
    /// React to the PoS contract
    fn react(
        instance: &state::Instance,
        _archive: &Archive,
        _post_payload: &Option<String>,
        _param: &(),
    ) -> Result<Reaction> {
        // get context (state) of the lottery instance
        let parsed: PoSCtxParsed =
            serde_json::from_str(&instance.json_data).chain_err(|| {
                format!(
                    "Could not parse PoS instance json_data: {}",
                    &instance.json_data
                )
            })?;
        let ctx: PoSCtx = parsed.into();
        trace!(
            "Context for PoS (index {}) {:?}",
            instance.index,
            ctx
        );

        // TODO: Move this to a parameter, it varies according to user/worker
        // behavior and base layer tx cost
        //let required_prize = 0;
        //let base_split = 10000;

        // TODO: check if cast to u_64() is problematic
        // TODO: Add ability to estimate transaction price and receive a
        // minimum required prize

        //let current_reward = ctx.current_prize.as_u64() * ctx.user_split.as_u64() / base_split;
        //if ctx.can_win && current_reward >= required_prize {
        if ctx.can_win {
            info!("Claiming victory for PoS (index: {})", instance.index);
            let request = TransactionRequest {
                concern: instance.concern.clone(),
                value: U256::from(0),
                function: "claimWin".into(),
                data: vec![
                    Token::Uint(instance.index),
                ],
                gas: None,
                strategy: transaction::Strategy::Simplest,
                contract_name: None, // Name not needed, is concern
            };
            return Ok(Reaction::Transaction(request));
        } else {
            //return idle
            return Ok(Reaction::Idle);
        }
    }

    fn get_pretty_instance(
        instance: &state::Instance,
        archive: &Archive,
        _param: &(),
    ) -> Result<state::Instance> {
        // get context (state) of the pos instance
        let parsed: PoSCtxParsed =
            serde_json::from_str(&instance.json_data).chain_err(|| {
                format!(
                    "Could not parse lottery instance json_data: {}",
                    &instance.json_data
                )
            })?;
        let ctx: PoSCtx = parsed.into();
        let json_data = serde_json::to_string(&ctx).unwrap();

        let pretty_sub_instances: Vec<Box<state::Instance>> = vec![];

        let pretty_instance = state::Instance {
            name: "PoS".to_string(),
            concern: instance.concern.clone(),
            index: instance.index,
            service_status: archive.get_service("PoS".into()),
            json_data: json_data,
            sub_instances: pretty_sub_instances,
        };

        return Ok(pretty_instance);
    }
}
