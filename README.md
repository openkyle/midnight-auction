# Midnight Auction

A tiny Foundry VTT v11 module for running quick, dramatic auctions in DnD5e.

## Install

1. Copy the `midnight-auction` folder into your Foundry `Data/modules` folder.
2. Restart Foundry or return to setup.
3. Enable **Midnight Auction** in your world.
4. Open the floating **Midnight Auction** button in the scene UI, or run the **Midnight Auction** macro.

## Use

- GMs open the small floating gavel icon. Drag it to move it.
- The auction window preloads its current artwork before opening to avoid image resize jumps.
- GMs can use the gear button to configure auction settings during play.
- Use the Lot tabs to move between fixed auction groups. A running tab shows `(Live)` and a completed or ended tab shows `(Ended)`.
- Drag items from the sidebar onto the selected round's drop area to add lots.
- Lots appear as a compact GM-only list with Start, End, and remove controls.
- Starting a round begins the first lot, and completed lots automatically advance to the next lot in that round.
- Live lot data is shared with players directly so their auction window updates even if their local round list is stale.
- Click **Start Round**, then **Start** on a lot.
- Drag actors into **Drop Auction Bidders here** to fill up to 10 placeholder bidder names.
- Use **NPC Bid** when the room should outbid the players. Each NPC bid picks a random NPC bidder and follows the same bid step as player bids.
- Players open the **Open Midnight Auction** macro from the included player macro compendium and press the bid button.
- Each accepted bid resets the timer to 10 seconds by default.
- When the timer reaches zero, the GM client closes the lot and deducts the winning gold from the winner's assigned character.
- Use **Reset Auction Rounds** to clear the live round state. It is disabled until the auction has started or has results to clear.
- Use **Store** to write the current auction data to a world compendium named **Midnight Auction Stores**.

## Settings

Open the gear panel in the GM auction window. The small help button in the bottom-right of the settings panel opens the in-module help page.

- **Bid Timer** sets the normal bidding countdown used when a lot is live.
- **Sudden Death Timer** sets the countdown length used when **Sudden Death** is enabled.
- **Read Time** sets how long players see the item preview before bidding opens, when **Lot Preview** is enabled.
- **Start %** sets the opening bid as a percentage of the item's market price, rounded down. Existing lots and active unopened prices update live.
- **Rounds** sets how many Lot tabs appear, from 1 to 10.
- **Bid Step** sets how much each player or NPC bid raises the current price.
- **Sudden Death** makes bids stop resetting the timer.
- **Lot Preview** opens each lot with a read-only preview phase before bidding begins.
- **Transfer to Player** copies the won item to the winning character when the lot closes.
- **Invite Players** opens the auction window for players when a round starts.
- **Hide Image Text** hides the title and status text over the large auction image.
- **Auction Photo** sets the default large auction image used when a lot does not provide a scene image.
- **Winner Sound** enables and selects the sound played when a lot has a winner.
- **Winner Vol.** controls the winner sound volume.
- **Start Sound** enables and selects the sound played when a round starts.
- **Start Vol.** controls the round-start sound volume.

## Saving And Storing

- **Save** keeps the current auction in one of three quick-save slots.
- **New** clears the builder for a fresh auction.
- **Load** restores a saved auction slot.
- **Store** writes the auction catalog to a Journal Entry in the world compendium **Midnight Auction Stores**. This is intended as a longer-term storage/export path.

Players need an assigned character with `system.currency.gp`, which matches DnD5e 2.4.x.
