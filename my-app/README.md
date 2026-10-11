# Lovas — Shared Whiteboard for Couples

An anonymous, no-auth shared whiteboard. Each device is a random anonymous identity (UUID stored locally). Two phones pair via an 8-character code (e.g. `BLUE-4829`) to open a private shared board — any stroke drawn on one phone appears on the other in real time.

## Features

- **No accounts, no sign-in.** Pairing is device-to-device: one phone creates a couple, the other joins with a code.
- **Realtime drawing.** Strokes sync via Supabase Realtime (`postgres_changes` on `strokes`); presence shows when your partner is on the board.
- **Optimistic drawing.** Your own stroke renders instantly, then persists to the backend. The network syncs in the background — never on the drawing path.
- **Operations, not images.** Every stroke is a stored operation (id, board, device, points, color, width, tool) with a unique client-generated operation id, so realtime events are idempotent and simultaneous strokes merge instead of replacing the canvas.
- **Full drawing toolbox.** Freehand pen with multiple colors, brush sizes, an eraser tool, undo, redo, and clear — all synced to the partner in real time.
- **Offline-friendly.** Strokes are cached locally and replayed on open, then reconciled with live data.
- **Auto-created shared board.** Pairing creates one board per couple (owned by the couple, so both devices reach it) named _Our First Board ❤️_.

## Stack

- **Expo SDK 54** + React Native 0.81, TypeScript strict mode
- **Expo Router** file-based routing (`app/`)
- **Supabase** (Postgres + Realtime), accessed through the anonymous key with open-but-id-gated RLS policies
- **react-native-svg** for the drawing canvas
- **expo-crypto** for anonymous identity generation (UUID)

## Project Structure

```
my-app/
├── app/                     # Expo Router pages
│   ├── (onboarding)/        # welcome, create-couple, join-couple
│   ├── (main)/              # tabs (home, board, settings)
│   │   └── board/           # index.tsx (tab → redirects to couple board) + [id].tsx (the whiteboard)
│   ├── _layout.tsx          # root layout + boot redirect (paired → home)
│   └── +not-found.tsx
├── components/
│   ├── ui/                  # Button, Text, Screen, theme
│   ├── board/               # DrawingCanvas, Toolbar
│   └── couple/              # DeviceProvider, CoupleProvider
├── hooks/
│   ├── board/useBoard.ts    # load strokes, realtime subscribe, submit, clear (+ presence)
│   └── couple/useCouple.ts  # couple state machine
├── lib/
│   ├── device/identity.ts   # anonymous UUID generation/persistence
│   ├── couple/pairing.ts    # code generation + join logic
│   ├── supabase/            # client, typed data layer, schema.sql
│   ├── realtime/            # stroke + presence channels
│   └── storage/             # AsyncStorage cache + keys
├── types/                   # shared TS types (couple, board, presence)
├── .env.example
└── ...
```

## Getting Started

### 1. Install

```bash
cd my-app
npm install --legacy-peer-deps
```

### 2. Configure Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Copy `.env.example` to `.env` and fill in your project's URL and anon key:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```

3. Open the **SQL Editor** in your Supabase dashboard and run the whole contents of `lib/supabase/schema.sql`. It creates:
   - Tables: `devices`, `couples`, `couple_members`, `boards` (one per couple, auto-named _Our First Board ❤️_), `strokes`, `board_counters`
   - RPCs: `register_device`, `create_couple`, `join_couple`, `get_board_id`, `get_boards`, `get_strokes`, `add_stroke`, `clear_board`, `next_sequence` (`join_couple` refuses a third device and `create_couple`/`join_couple` refuse an already-paired device)
   - RLS policies for the `anon` role (identity-gated; no auth used)
   - Publication `supabase_realtime` on `strokes` (streams INSERT/DELETE)

### 3. Run

```bash
npm start
```

Scan with Expo Go. To test the realtime "aha moment", open the app on two devices, create a couple on one, join with the code on the other, and draw.

## Environment Variables

All client-side vars use the `EXPO_PUBLIC_` prefix. See `.env.example` for the full list.

## Scripts

```bash
npm start          # Start Expo dev server
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run on web
npm run lint       # ESLint
npm run format     # Prettier (write)
npm run typecheck  # tsc --noEmit
```

## How Realtime Works

1. The drawing client generates a unique operation id and renders the stroke optimistically (local-first, zero network wait).
2. The stroke is persisted via the `add_stroke` RPC — the server keeps the client id and assigns the monotonic per-board `sequence`.
3. Supabase Realtime broadcasts to the `supabase_realtime` publication on `strokes`; INSERT echoes replace the local placeholder (adopting the server sequence) and INSERTs from the partner append to the merged canvas.
4. DELETE events (undo or clear) remove the matching operation from both canvases.
5. Undo/redo call `delete_stroke`/`restore_stroke` (which reuses the original id + sequence), keeping dedup and ordering correct.
6. Presence (`RealtimeChannel.track`) signals whether your partner is viewing the board.

Incoming operations merge by `id` — strokes are never replaced wholesale, so two people can draw simultaneously without clobbering each other.

## License

MIT
