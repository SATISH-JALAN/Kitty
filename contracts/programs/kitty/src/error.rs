use anchor_lang::prelude::*;

#[error_code]
pub enum KittyError {
    #[msg("Only the config admin can do this")]
    NotAdmin,
    #[msg("New parties are paused")]
    Paused,
    #[msg("Dev registration is off")]
    DevRegisterOff,
    #[msg("The proof does not verify")]
    InvalidProof,
    #[msg("A value is not a valid field element")]
    BadFieldElement,
    #[msg("The proof's root is not one of the last 64 roots")]
    UnknownRoot,
    #[msg("The proof's clock is too far from the chain's")]
    BadClock,
    #[msg("The Kitty tree is full")]
    TreeFull,
    #[msg("A party has 4 to 20 guests")]
    BadGuestCount,
    #[msg("The host fee is above the cap")]
    HostFeeTooHigh,
    #[msg("Grace hours are shorter than allowed")]
    GraceTooShort,
    #[msg("Bad party timing")]
    BadTiming,
    #[msg("Unknown order mode")]
    BadMode,
    #[msg("The House Fund reserve is too low for another party")]
    ReserveTooLow,
    #[msg("This party is not open for RSVPs")]
    NotForming,
    #[msg("This party is full")]
    PartyFull,
    #[msg("The RSVP window has closed")]
    FormationClosed,
    #[msg("This guest is already at the party")]
    AlreadyJoined,
    #[msg("No seat is left for this tier")]
    NoSeat,
    #[msg("Auto-pay is not approved for this party")]
    AutoPayMissing,
    #[msg("The invite signature is missing or wrong")]
    BadInvite,
    #[msg("This party is not running")]
    NotActive,
    #[msg("Not a guest of this party")]
    NotAGuest,
    #[msg("Nothing is due")]
    NothingDue,
    #[msg("This round is not due yet")]
    NotDue,
    #[msg("Wrong round")]
    WrongRound,
    #[msg("The Draw is already requested")]
    DrawPending,
    #[msg("No Draw for this round yet")]
    NoDraw,
    #[msg("The randomness account is wrong")]
    BadRandomness,
    #[msg("The randomness is not fulfilled yet")]
    RandomnessPending,
    #[msg("No guest is eligible tonight")]
    NoEligibleGuest,
    #[msg("This party uses a seating plan")]
    NotDrawMode,
    #[msg("Tonight's guest is in grace hours")]
    WinnerInGrace,
    #[msg("The House Fund cannot cover this")]
    HouseFundShort,
    #[msg("A token account does not match")]
    WrongTokenAccount,
    #[msg("Grace hours have not ended")]
    GraceNotOver,
    #[msg("This guest is not in grace hours")]
    NotInGrace,
    #[msg("Nothing to settle")]
    NothingToSettle,
    #[msg("This guest already took the kitty")]
    AlreadyTook,
    #[msg("The party has not finished")]
    NotFinished,
    #[msg("Farewell already done")]
    AlreadyFarewelled,
    #[msg("Settle up before Farewell")]
    SettleUpFirst,
    #[msg("Farewell has not happened for this guest")]
    NoFarewell,
    #[msg("The nullifier is already spent")]
    NullifierSpent,
    #[msg("The party filled up in time")]
    PartyFilled,
    #[msg("The House Fund reserve rule blocks this withdrawal")]
    ReserveRule,
    #[msg("Amount must be above zero")]
    ZeroAmount,
    #[msg("Math overflow")]
    Overflow,
}
