# Desert Victory Described — build notes

## Copy used
- Source: https://archive.org/details/DesertVictory
- File: `DesertVictory.mp4` (h.264, 640×480, 29.97 fps, AAC audio)
- Exact duration: **4229.496 seconds**, stated as **1:10:29.50**
- Licence on the Archive item: public domain (Crown copyright expired)
- The same picture is on Wikimedia Commons as a 1:10:29 WebM
- The IWM stream is a shorter cut and must not be used with this companion

The Archive file is *Desert Victory* itself until about 1:01:07 (credits: music by William Alwyn, commentary written by J. L. Hodson, spoken by Leo Genn), then an appended US official newsreel, Film Bulletin No. 47, “U.S. Attacks in the Aleutians”.

## How the cues were made
- Commentary was transcribed with faster-whisper (`small.en`, word timestamps, VAD) from a 16 kHz mono extract. Word times were used only to find gaps, not as a published transcript (the wording is often imperfect).
- Frames were taken every 2.5 seconds, plus scene-change frames, and the night attack was contrast-boosted so dark frames could be read.
- Descriptions were placed only in commentary gaps, with a margin so speech should finish before the next line of commentary at normal rate.
- Historian’s notes, in the voice of Captain Henry Ashcombe (an invented 1780s English officer-scholar), cover: the unflankable Alamein line and the Qattara Depression; the first Alamein and Alam Halfa; the build-up and Sherman tanks; Lightfoot, the Devil’s Gardens, and 21:40 hours on 23 October; the Pinewood reconstruction of the night “Fire” close-ups (about 200 feet, while the barrage flashes are genuine); crumbling and Supercharge (1–2 November, break 4 November); the pursuit to Tobruk (13 November) and Tripoli (23 January 1943); wartime casualty ratios treated with caution; and the appended newsreel.

## Build and test
    # Do not commit source/ or analysis/
    python3 -m http.server 8765 --directory site
    cd tests && npm test

## Publish
    tools/publish-gh.sh
    # creates a NEW public repo ahsantheman55-blip/desert-victory-described
    # refuses if the repo already exists; never prints tokens; does not copy the video

## Limits
- Not tested on a real iPhone or with VoiceOver.
- The page cannot hear the film or duck its sound.
- Speech may stop if the phone locks or the tab is backgrounded; the keep-awake button uses the Screen Wake Lock API where the browser allows it.
- Cue times may be off by a fraction of a second.
- Night scenes are very dark; some descriptions rely on contrast-boosted frames.
