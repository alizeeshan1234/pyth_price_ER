use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::{price_update::PriceUpdateV2};
use pyth_solana_receiver_sdk::price_update::get_feed_id_from_hex;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};

declare_id!("9udcwDXrPDs6MgCxEh7tKp9jBzpK41AaG6GXhgpuk8pB");

#[program]
pub mod er_pyth {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn fetch_price(ctx: Context<PriceAccountInfo>) -> Result<()> {

        let price_feed = get_feed_id_from_hex("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d")?;

        let max_age = 3600;

        let clock = Clock::get()?;

        let price = ctx.accounts.price_update_account.get_price_no_older_than(&clock, max_age, &price_feed)?;

        msg!("Price: {}", price.price);

        Ok(())
    }

    pub fn initialize_price_account(ctx: Context<InitializePriceAccount>) -> Result<()> {

        let price_account_info = &mut ctx.accounts.price_account_info;

        price_account_info.price = 0;

        msg!("Price Account Initialized SUccessfully!");

        Ok(())
    }

    pub fn delegate_price_account(ctx: Context<DelegatePriceAccount>, commet_frequency: u32, validator_key: Pubkey) -> Result<()> {

        let delegate_config = DelegateConfig {
            commit_frequency_ms: commet_frequency,
            validator: Some(validator_key), 
        };

        let seeds: &[&[u8]] = &[
            b"price_account"
        ];

        ctx.accounts.delegate_price_account_info(&ctx.accounts.payer, seeds, delegate_config)?;

        msg!("Price Account Delgated Successfully!");

        Ok(())
    }

    pub fn update_price_er(ctx: Context<UpdatePriceER>) -> Result<()> {

        let price_account_info = &mut ctx.accounts.price_account_info;

        let price_feed = get_feed_id_from_hex("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d")?;

        let max_age = 3600;

        let clock = Clock::get()?;

        let price = ctx.accounts.price_update_account.get_price_no_older_than(&clock, max_age, &price_feed)?;

        price_account_info.price = price.price;

        msg!("Price Account Updated!");
        msg!("Price Account Info: {:?}", price_account_info);

        Ok(())
    }

    pub fn commit_and_undelegate_price_account(ctx: Context<CommitPriceAndUndelegate>) -> Result<()> {

        commit_and_undelegate_accounts(
            &ctx.accounts.payer, 
            vec![
                &ctx.accounts.price_account_info.to_account_info(),
            ], 
            &ctx.accounts.magic_context, 
            &ctx.accounts.magic_program
        )?;

        msg!("Account Undelegated Successfully!");

        Ok(())
    }


}

#[derive(Accounts)]
pub struct Initialize {}

#[derive(Accounts)]
pub struct PriceAccountInfo<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub price_update_account: Account<'info, PriceUpdateV2>,

}

#[derive(Accounts)]
pub struct InitializePriceAccount<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = 8 + PriceAccount::INIT_SPACE,
        seeds = [b"price_account"],
        bump
    )]
    pub price_account_info: Account<'info, PriceAccount>,

    pub system_program: Program<'info, System>,
}

#[delegate]
#[derive(Accounts)]
pub struct DelegatePriceAccount<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        del,
        seeds = [b"price_account"],
        bump
    )]
    pub price_account_info: Account<'info, PriceAccount>,
}

#[derive(Accounts)]
pub struct UpdatePriceER<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [b"price_account"],
        bump
    )]
    pub price_account_info: Account<'info, PriceAccount>,

    // #[account(mut)]
    pub price_update_account: Account<'info, PriceUpdateV2>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitPriceAndUndelegate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"price_account"],
        bump
    )]
    pub price_account_info: Account<'info, PriceAccount>,
}

#[account]
#[derive(Debug, InitSpace)]
pub struct PriceAccount {
    pub price: i64
}