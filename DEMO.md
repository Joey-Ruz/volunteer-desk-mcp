# Demo script

Four prompts, typed in Claude Desktop in this order. Target length: 60–90 seconds.

**Before each take:** run `npm run reset`, then start a new chat in Claude Desktop. The data is identical on every reset, and dates are relative to the reset day. "In 2 days" below means 2 days after you reset.

---

### 1. What needs people this week?

> What's coming up at the pantry this week, and which shifts are still short on people?

**Expected:** Claude calls `list_upcoming_events` and/or `find_unfilled_shifts`. It reports **7 open slots** in the next week:
- **Food Distribution** (in 2 days, Main Hall): 1 Greeter and 3 Line Servers still needed.
- **Warehouse Sort** (in 5 days): 3 Sorters still needed.

It may also mention the fully staffed Food Distribution in 9 days and the larger gaps further out (Food Drive Kickoff in 21 days needs 9).

### 2. Who's gone quiet?

> Who haven't we been in touch with in the last 3 weeks? Put anyone we've never contacted at the top.

**Expected:** Claude calls `find_volunteers_not_contacted` with `days: 21` and returns **15 volunteers**:
- **5 never contacted:** Blake Merriweather, Imani Thistlewood, Lionel Quillfeather, Otis Pembrook, Talia Ellery.
- Then the longest silences, led by **Nadia Birchfield (70 days)** and Umar Greystone (68 days).

### 3. Draft a personal ask

> Pull up Nadia Birchfield's history and draft a short, friendly email asking if she can cover a Line Server shift at the Food Distribution in two days.

**Expected:** Claude calls `get_volunteer_history` with `name: "Nadia Birchfield"`. It notes that she:
- prefers email;
- attended a Line Server shift about 5 weeks ago;
- is already signed up as a Sorter at the Warehouse Sort and for Cleanup at the later Food Distribution;
- was last reached about 70 days ago, when she said she was happy to help with sorting.

It drafts a personal email in the chat. **Nothing is sent**: the server has no send tool.

### 4. Log the follow-ups in one go (confirm before write)

> I just called Nadia and left a voicemail about it. I also texted Blake Merriweather and Umar Greystone, and both said they can help. Log all three.

**Expected:** Claude calls `log_contact_attempt` once, **without** a token, with all three contacts in one list. The server saves nothing and returns one preview of 3 entries, all stamped with the current time:
- Nadia Birchfield: call, left_message, with a short note;
- Blake Merriweather: text, reached;
- Umar Greystone: text, reached.

It also returns one token, like `confirm-6cdf93`. Claude shows the preview and asks you to approve it.

> Yes, save them.

**Expected:** Claude calls again with the same three contacts and the token. The server confirms `saved` with a count of **3**: one approval for the whole group. (Optional on camera: ask question 2 again, and the list drops to **12**, without Nadia, Blake, or Umar.)
