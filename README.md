# Midnight Auction

A tiny Foundry VTT v11 module for running quick, dramatic auctions in DnD5e.

## Install

1. Copy the `midnight-auction` folder into your Foundry `Data/modules` folder.
2. Restart Foundry or return to setup.
3. Enable **Midnight Auction** in your world.
4. Open the floating **Midnight Auction** button in the scene UI, or run the **Midnight Auction** macro.

## Use

- GMs open the floating **Midnight Auction** button.
- Click **Add Round** and **Add Lot** to build the auction directly in the window.
- Set each lot's name, image, scene image, description, starting price, and bid increment.
- Click **Start Round**, then **Start** on a lot.
- Players open the floating button or the **Open Midnight Auction** macro and press the bid button.
- Each accepted bid resets the timer to 10 seconds by default.
- When the timer reaches zero, the GM client closes the lot and deducts the winning gold from the winner's assigned character.

## Settings

- **Bid Timer Seconds** controls the countdown length.
- **Default Bid Increment** controls the fallback increment for items.
- **Scene Images** accepts up to four image paths, one per line: idle, round live, item live, sold.

Players need an assigned character with `system.currency.gp`, which matches DnD5e 2.4.x.
