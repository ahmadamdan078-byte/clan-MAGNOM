#!/usr/bin/env python3
import random
from pathlib import Path

random.seed(42)

def t(id, name, cat, **kw):
    return dict(
        id=id, name=name, cat=cat,
        filter=kw.get('filter', 'none'),
        effect=kw.get('effect', 'none'),
        music=kw.get('music', 'none'),
        textStyle=kw.get('textStyle', 'clean'),
        caption=kw.get('caption', ''),
        bright=kw.get('bright', 1.05),
        contrast=kw.get('contrast', 1.1),
        saturate=kw.get('saturate', 1.1),
        ratio=kw.get('ratio', '9x16'),
        fit=kw.get('fit', 'cover'),
        photoDuration=kw.get('photoDuration', 8),
        uses=kw.get('uses', random.randint(80000, 900000)),
        badge=kw.get('badge', ''),
        trending=kw.get('trending', False),
        forYou=kw.get('forYou', False),
        source=kw.get('source', 'capcut'),
        cover=kw.get('cover', ''),
    )

templates = [
    t('cc_slowmoTrend', 'New Trending SlowMo', 'Slow Motion', filter='soft', effect='softFocus', music='calmWaves', textStyle='minimal', uses=5300000, badge='Hot', trending=True, forYou=True, photoDuration=12, bright=1.12, contrast=0.95, saturate=0.9),
    t('cc_slowmoClassic', 'Slow Motion Template', 'Slow Motion', filter='cinema', effect='slowReveal', music='memories', textStyle='clean', uses=4800000, badge='Hot', trending=True, forYou=True, photoDuration=14, bright=0.95, contrast=1.25, saturate=0.88),
    t('cc_slowmoNew', 'New SlowMo Video', 'Slow Motion', filter='haze', effect='fadePulse', music='whisperPad', textStyle='shadow', uses=4100000, badge='Hot', trending=True, forYou=True, photoDuration=11, bright=1.15, contrast=0.88, saturate=0.75),
    t('cc_smoothSlomo', '4 Clips Smooth Slomo', 'Slow Motion', filter='muted', effect='kenBurns', music='lofiLoop', textStyle='minimal', uses=993700, trending=True, forYou=True, photoDuration=15, fit='contain'),
    t('cc_viralSlowmo', 'Viral SlowMo Video', 'Slow Motion', filter='bloom', effect='float', music='goldenHour', textStyle='gradient', uses=868900, badge='Hot', trending=True, forYou=True, ratio='1x1'),
    t('cc_trendSlowmo', 'Trend SlowMo', 'Slow Motion', filter='fade', effect='softFocus', music='nightDrive', textStyle='clean', uses=570800, trending=True, bright=1.08, contrast=1.05, saturate=1.0),
    t('cc_trendingSlowmo', 'Trending Slowmotion', 'Slow Motion', filter='moonlight', effect='drift', music='spaceEcho', textStyle='iceText', uses=256100, trending=True, bright=0.92, contrast=1.2, saturate=0.7),
    t('cc_slowmoHdr', 'SLOWMO HDR', 'Slow Motion', filter='vivid', effect='blurIn', music='highEnergy', textStyle='impact', uses=120200, badge='New', saturate=1.8),
    t('cc_velocity2026', 'Velocity Edit 2026', 'Slow Motion', filter='chrome', effect='whipPan', music='trapBeat', textStyle='outline', uses=890000, trending=True, forYou=True, contrast=1.3),
    t('cc_cinematicSlow', 'Cinematic SlowMo', 'Slow Motion', filter='cinema', effect='kenBurns', music='memories', textStyle='typewriter', uses=445000, photoDuration=16, ratio='16x9'),
    t('cc_smoothVelocity', 'Smooth Velocity', 'Slow Motion', filter='soft', effect='fadePulse', music='calmWaves', textStyle='minimal', uses=720000, trending=True, photoDuration=10),
    t('cc_dreamySlow', 'Dreamy Slow Motion', 'Slow Motion', filter='pastel', effect='float', music='whisperPad', textStyle='sticky', uses=310000, photoDuration=13, bright=1.18, saturate=0.65),
    t('cc_ical', 'Ical CapCut Template', 'Trending', filter='pink', effect='glitchRGB', music='popHook', textStyle='bubble', uses=3600000, badge='Hot', trending=True, forYou=True, saturate=1.5),
    t('cc_teraHun', 'Tera Hun Jaan Le', 'Trending', filter='drama', effect='crashZoom', music='latinFire', textStyle='fireText', uses=2100000, badge='Hot', trending=True, forYou=True, contrast=1.35),
    t('cc_dilLaga', 'Dil Laga Leya', 'Trending', filter='warm', effect='elastic', music='orientalGold', textStyle='banner', uses=809100, trending=True, forYou=True, bright=1.1),
    t('cc_hindiOld', 'Hindi Old Songs', 'Trending', filter='vintage', effect='vhs', music='memories', textStyle='typewriter', uses=132200, forYou=True, bright=0.98),
    t('cc_ramadanVel', 'Ramadan Velocity 2026', 'Trending', filter='gold', effect='rise', music='orientalGold', textStyle='gold', uses=670000, trending=True, forYou=True, caption='RAMADAN 2026'),
    t('cc_jjEdit', 'JJ 2026 Viral Edit', 'Trending', filter='neon', effect='neonGlitch', music='cyberPulse', textStyle='neon', uses=540000, trending=True, badge='New'),
    t('cc_proEdit2026', 'Pro Edit 2026', 'Trending', filter='sharp', effect='hypeCut', music='sparkBurst', textStyle='impact', uses=480000, trending=True),
    t('cc_ytViral', 'YouTube Viral Edit', 'Trending', filter='vivid', effect='zoomBig', music='hypeDrop', textStyle='boxed', uses=390000, trending=True, ratio='16x9'),
    t('cc_gangster', 'Gangster Vibes', 'Attitude', filter='bw', effect='hardCut', music='trapBeat', textStyle='impact', caption='VILLAIN', uses=2900000, badge='Hot', trending=True, forYou=True, contrast=1.4, saturate=0.2),
    t('cc_dassJatta', 'Dass Jatta', 'Attitude', filter='ember', effect='shakeHard', music='rockAnthem', textStyle='impact', uses=785600, trending=True, bright=1.0, contrast=1.3),
    t('cc_villain', 'Villain', 'Attitude', filter='midnight', effect='glitchChaos', music='darkMatter', textStyle='comic', caption='VILLAIN', uses=587200, badge='Hot', trending=True, bright=0.88),
    t('cc_attitude', 'Attitude Song', 'Attitude', filter='steel', effect='slam', music='metalRiff', textStyle='shadow', uses=260000, trending=True, contrast=1.35),
    t('cc_bossMode', 'Boss Mode', 'Attitude', filter='ink', effect='pushIn', music='finalBoss', textStyle='outline', caption='BOSS', uses=340000, trending=True, forYou=True),
    t('cc_darkAura', 'Dark Aura', 'Attitude', filter='toxic', effect='glitch', music='thunder', textStyle='glowPink', uses=220000, badge='New', bright=0.9),
    t('cc_phonkViral', 'Phonk Viral Edit', 'Viral', filter='matrix', effect='strobe', music='dubstep', textStyle='glowPink', uses=1500000, badge='Hot', trending=True, forYou=True, saturate=1.7),
    t('cc_aestheticMain', 'Main Character Energy', 'Viral', filter='bloom', effect='pop', music='popHook', textStyle='pink', uses=980000, trending=True, forYou=True, bright=1.12),
    t('cc_inspiring', 'Inspiring Moments', 'Viral', filter='sunset', effect='rise', music='sunrise', textStyle='gradient', uses=640000, trending=True, forYou=True),
    t('cc_corecore', 'Corecore Edit', 'Viral', filter='bleach', effect='vhs', music='darkMatter', textStyle='typewriter', uses=410000, trending=True, forYou=True, contrast=1.45),
    t('cc_brainrot', 'Brainrot Meme Cut', 'Viral', filter='acid', effect='jitter', music='pixelHop', textStyle='comic', uses=380000, trending=True, badge='New'),
    t('cc_rizzCam', 'Rizz Camera', 'Viral', filter='glow', effect='bounce', music='popHook', textStyle='bubble', uses=290000, forYou=True, bright=1.15, saturate=1.4),
    t('cc_dump2026', '2026 Photo & Video Dump', 'Photo Dump', filter='polaroid', effect='kenBurns', music='lofiLoop', textStyle='typewriter', caption='2026 SO FAR', uses=2200000, badge='Hot', trending=True, forYou=True, photoDuration=14),
    t('cc_juneDump', 'June Photo Dump', 'Photo Dump', filter='pastel', effect='fadePulse', music='calmWaves', textStyle='sticky', caption='JUNE DUMP', uses=890000, badge='New', trending=True, forYou=True),
    t('cc_midYear', 'Mid-Year Recap 2026', 'Photo Dump', filter='amber', effect='slowReveal', music='memories', textStyle='banner', caption='MID YEAR', uses=1100000, badge='Hot', trending=True, forYou=True, photoDuration=15),
    t('cc_summerPost', 'Summer Postcard', 'Photo Dump', filter='sunset', effect='float', music='goldenHour', textStyle='gradient', uses=750000, trending=True, forYou=True, ratio='1x1', fit='contain'),
    t('cc_cameraRoll', 'Camera Roll Dump', 'Photo Dump', filter='wes', effect='drift', music='jazzSwing', textStyle='minimal', uses=520000, forYou=True, ratio='1x1'),
    t('cc_monthlyRecap', 'Monthly Recap', 'Photo Dump', filter='polaroid', effect='kenBurns', music='whisperPad', textStyle='clean', uses=410000, forYou=True, photoDuration=12),
    t('cc_btsDump', 'Behind The Scenes', 'Photo Dump', filter='muted', effect='softFocus', music='warmup', textStyle='typewriter', uses=380000, fit='contain'),
    t('cc_recapHalf', '2026 Recap So Far', 'Photo Dump', filter='firewatch', effect='rise', music='comeback', textStyle='gradient', caption='2026 RECAP', uses=670000, badge='New', trending=True),
    t('cc_weekendDump', 'Weekend Dump', 'Photo Dump', filter='fog', effect='fadePulse', music='lobby', textStyle='sticky', caption='WEEKEND', uses=310000, forYou=True, bright=1.14),
    t('cc_travelDump', 'Travel Dump', 'Photo Dump', filter='ocean', effect='whipPan', music='spaceEcho', textStyle='iceText', uses=280000, photoDuration=13),
    t('cc_beatDrop', 'Beat Drop Sync', 'Beat Sync', filter='vivid', effect='heartbeat', music='hypeDrop', textStyle='impact', uses=1800000, badge='Hot', trending=True, forYou=True, photoDuration=5),
    t('cc_phonkSync', 'Phonk Beat Sync', 'Beat Sync', filter='toxic', effect='strobe', music='dubstep', textStyle='glowPink', uses=1200000, trending=True, forYou=True, photoDuration=6),
    t('cc_trapSync', 'Trap Beat Sync', 'Beat Sync', filter='purple', effect='wobble', music='trapBeat', textStyle='pink', uses=940000, trending=True, photoDuration=7),
    t('cc_bassBoost', 'Bass Boost Sync', 'Beat Sync', filter='acid', effect='arenaBoom', music='deepBass', textStyle='impact', uses=720000, trending=True, photoDuration=5),
    t('cc_kickSync', 'Kick Sync Edit', 'Beat Sync', filter='neon', effect='snap', music='kickoff', textStyle='neon', uses=580000, photoDuration=4),
    t('cc_hardSync', 'Hard Sync Cuts', 'Beat Sync', filter='sharp', effect='hypeCut', music='sparkBurst', textStyle='boxed', uses=460000, photoDuration=5),
    t('cc_houseSync', 'House Beat Sync', 'Beat Sync', filter='candy', effect='pop', music='houseBeat', textStyle='glowPink', uses=390000, photoDuration=8),
    t('cc_rockSync', 'Rock Beat Sync', 'Beat Sync', filter='bleach', effect='shake', music='rockAnthem', textStyle='impact', uses=330000, photoDuration=6),
    t('cc_latinSync', 'Latin Beat Sync', 'Beat Sync', filter='ruby', effect='swing', music='latinFire', textStyle='banner', uses=270000, photoDuration=7),
    t('cc_netflixDoc', 'Netflix Documentary', 'Cinematic', filter='cinema', effect='pushIn', music='darkMatter', textStyle='clean', caption='THE STORY', uses=850000, badge='New', trending=True, forYou=True, photoDuration=14, ratio='16x9'),
    t('cc_cinematicMood', 'Cinematic Mood', 'Cinematic', filter='bleach', effect='kenBurns', music='memories', textStyle='minimal', uses=620000, forYou=True, photoDuration=16, ratio='16x9'),
    t('cc_filmVlog', 'Film Look Vlog', 'Cinematic', filter='vintage', effect='softFocus', music='jazzSwing', textStyle='typewriter', uses=480000, ratio='16x9', fit='contain'),
    t('cc_wesTone', 'Wes Anderson Style', 'Cinematic', filter='wes', effect='drift', music='jazzSwing', textStyle='banner', uses=390000, ratio='16x9', bright=1.08, saturate=1.25),
    t('cc_noirFilm', 'Noir Film', 'Cinematic', filter='bw', effect='hardCut', music='darkMatter', textStyle='outline', uses=340000, bright=0.95, contrast=1.4, saturate=0.15),
    t('cc_goldenCine', 'Golden Hour Cine', 'Cinematic', filter='sunset', effect='fadePulse', music='goldenHour', textStyle='gradient', uses=510000, forYou=True, bright=1.12, saturate=1.35),
    t('cc_epicTrailer', 'Epic Trailer', 'Cinematic', filter='drama', effect='crashZoom', music='thunder', textStyle='impact', caption='EPIC', uses=440000, trending=True, ratio='16x9', photoDuration=10),
    t('cc_dayLife', 'Day In My Life', 'Vlog', filter='crisp', effect='kenBurns', music='lobby', textStyle='clean', uses=720000, forYou=True),
    t('cc_travelVlog', 'Travel Vlog', 'Vlog', filter='ocean', effect='whipPan', music='spaceEcho', textStyle='iceText', uses=580000, forYou=True, photoDuration=11),
    t('cc_aestheticVlog', 'Aesthetic Vlog', 'Vlog', filter='haze', effect='float', music='lofiLoop', textStyle='minimal', uses=490000, forYou=True, bright=1.14),
    t('cc_morningRoutine', 'Morning Routine', 'Vlog', filter='bloom', effect='rise', music='sunrise', textStyle='sticky', uses=410000, bright=1.1),
    t('cc_gymVlog', 'Gym Vlog', 'Vlog', filter='sharp', effect='impact', music='highEnergy', textStyle='impact', uses=360000, contrast=1.25),
    t('cc_studyVlog', 'Study With Me', 'Vlog', filter='pastel', effect='softFocus', music='whisperPad', textStyle='typewriter', uses=290000, forYou=True, fit='contain'),
    t('cc_gradGlow', 'Graduation Glow-Up', 'Seasonal', filter='glow', effect='elastic', music='comeback', textStyle='banner', caption='THEN VS NOW', uses=540000, badge='New', trending=True),
    t('cc_innerVoice', 'My Inner Voice', 'Seasonal', filter='soft', effect='pop', music='popHook', textStyle='comic', uses=430000, trending=True, forYou=True),
    t('cc_gradSeason', 'Graduation Season', 'Seasonal', filter='warm', effect='slowReveal', music='memories', textStyle='gradient', uses=390000, badge='New'),
    t('cc_giveMeTen', 'Give Me Ten', 'Seasonal', filter='vivid', effect='bounce', music='houseBeat', textStyle='bubble', uses=280000),
    t('cc_winterMood', 'Winter Mood', 'Seasonal', filter='arctic', effect='iceFx', music='calmWaves', textStyle='iceText', uses=240000, bright=1.1, saturate=0.8),
    t('cc_y2k', 'Y2K Aesthetic', 'Aesthetic', filter='pink', effect='glitchRGB', music='synthwave', textStyle='glowPink', uses=890000, badge='Hot', trending=True, forYou=True, saturate=1.55),
    t('cc_darkAcademia', 'Dark Academia', 'Aesthetic', filter='ink', effect='kenBurns', music='jazzSwing', textStyle='typewriter', uses=560000, forYou=True, bright=0.92, contrast=1.3, saturate=0.6),
    t('cc_cottagecore', 'Cottagecore', 'Aesthetic', filter='forest', effect='float', music='calmWaves', textStyle='sticky', uses=480000, forYou=True, bright=1.1, saturate=1.05),
    t('cc_cleanGirl', 'Clean Girl', 'Aesthetic', filter='soft', effect='softFocus', music='whisperPad', textStyle='minimal', uses=420000, forYou=True, bright=1.15, contrast=0.92, saturate=0.85),
    t('cc_oldMoney', 'Old Money', 'Aesthetic', filter='copper', effect='drift', music='jazzSwing', textStyle='gold', uses=390000, forYou=True, bright=1.02, saturate=0.9),
    t('cc_coastal', 'Coastal Grandmother', 'Aesthetic', filter='ocean', effect='fadePulse', music='goldenHour', textStyle='clean', uses=340000, bright=1.12, saturate=1.0),
    t('cc_indieKid', 'Indie Kid', 'Aesthetic', filter='lime', effect='tiltLeft', music='lofiLoop', textStyle='chalk', uses=310000, saturate=1.45),
    t('cc_vaporwave', 'Vaporwave', 'Aesthetic', filter='violet', effect='glitch', music='synthwave', textStyle='neon', uses=370000, trending=True, bright=1.05, saturate=1.5),
    t('cc_fortnite', 'Fortnite Montage', 'Gaming', filter='neon', effect='zoom', music='boost', textStyle='impact', caption='VICTORY', uses=620000, trending=True, forYou=True, saturate=1.4),
    t('cc_minecraft', 'Minecraft Edit', 'Gaming', filter='lime', effect='bounce', music='pixelHop', textStyle='comic', uses=540000, forYou=True, bright=1.08),
    t('cc_gtaCine', 'GTA Cinematic', 'Gaming', filter='cinema', effect='drift', music='nightDrive', textStyle='shadow', uses=480000, trending=True, ratio='16x9', bright=0.95),
    t('cc_valorant', 'Valorant Ace', 'Gaming', filter='cold', effect='flashCyan', music='laserBeam', textStyle='glowCyan', caption='ACE', uses=410000, contrast=1.25),
    t('cc_roblox', 'Roblox Edit', 'Gaming', filter='candy', effect='pop', music='arcade', textStyle='bubble', uses=350000, forYou=True, saturate=1.6),
    t('cc_fpsMontage', 'FPS Montage', 'Gaming', filter='sharp', effect='snap', music='metalRiff', textStyle='boxed', uses=320000, photoDuration=5),
    t('cc_racing', 'Racing Highlights', 'Gaming', filter='chrome', effect='whipPan', music='highEnergy', textStyle='impact', uses=290000, ratio='16x9'),
    t('cc_football', 'Football Highlights', 'Sports', filter='vivid', effect='slam', music='stadium', textStyle='impact', caption='GOAL', uses=470000, trending=True, ratio='16x9'),
    t('cc_basketball', 'Basketball Swish', 'Sports', filter='heat', effect='bounceBig', music='crowdCheer', textStyle='fireText', uses=390000),
    t('cc_boxing', 'Boxing Knockout', 'Sports', filter='drama', effect='shakeHard', music='drumRoll', textStyle='impact', uses=310000, contrast=1.35, photoDuration=5),
    t('cc_f1', 'F1 Speed Edit', 'Sports', filter='chrome', effect='whipPan', music='highEnergy', textStyle='neon', uses=280000, ratio='16x9', photoDuration=6),
    t('cc_skate', 'Skate Edit', 'Sports', filter='retro', effect='tiltRight', music='rockAnthem', textStyle='outline', uses=250000, fit='contain'),
    t('cc_flashTrans', 'Flash Transition', 'Transition', filter='none', effect='flash', music='sparkBurst', textStyle='clean', uses=520000, trending=True, photoDuration=3),
    t('cc_zoomTrans', 'Zoom Transition', 'Transition', filter='crisp', effect='zoomBig', music='kickoff', textStyle='impact', uses=440000, trending=True, photoDuration=4),
    t('cc_glitchTrans', 'Glitch Transition', 'Transition', filter='cyberpunk', effect='glitchChaos', music='cyberPulse', textStyle='glowPink', uses=380000, badge='New', photoDuration=4),
    t('cc_spinTrans', 'Spin Transition', 'Transition', filter='vivid', effect='spinFull', music='flipReset', textStyle='neon', uses=330000, photoDuration=5),
    t('cc_blurTrans', 'Blur Transition', 'Transition', filter='soft', effect='blurPulse', music='aerial', textStyle='minimal', uses=270000, photoDuration=4),
    t('cc_vhsTape', 'VHS Tape', 'Retro', filter='retro', effect='vhs', music='arcade', textStyle='comic', uses=410000, forYou=True, bright=1.05),
    t('cc_80sNeon', '80s Neon', 'Retro', filter='pink', effect='neonGlitch', music='synthwave', textStyle='neon', uses=360000, trending=True, saturate=1.5),
    t('cc_polaroid90', '90s Polaroid', 'Retro', filter='polaroid', effect='kenBurns', music='memories', textStyle='typewriter', uses=300000, ratio='1x1', fit='contain'),
    t('cc_disco', 'Disco Fever', 'Retro', filter='candy', effect='strobe', music='houseBeat', textStyle='glowPink', uses=260000, saturate=1.7),
    t('cc_cherryBlossom', 'Cherry Blossom', 'Nature', filter='bloom', effect='float', music='calmWaves', textStyle='clean', uses=450000, forYou=True, bright=1.12, saturate=1.2),
    t('cc_rainyDay', 'Rainy Day', 'Nature', filter='cold', effect='ripple', music='whisperPad', textStyle='iceText', uses=380000, bright=0.95, contrast=1.15, saturate=0.85),
    t('cc_desertGold', 'Desert Gold', 'Nature', filter='ember', effect='kenBurns', music='sunrise', textStyle='fireText', uses=320000, bright=1.08, saturate=1.3),
    t('cc_northernLights', 'Northern Lights', 'Nature', filter='aurora', effect='fadePulse', music='spaceEcho', textStyle='glowCyan', uses=290000, bright=1.05, saturate=1.35),
    t('cc_dubai', 'Dubai Luxury', 'Luxury', filter='gold', effect='flashGold', music='orientalGold', textStyle='gold', uses=510000, forYou=True, bright=1.1, saturate=1.25),
    t('cc_paris', 'Paris Nights', 'Luxury', filter='moonlight', effect='drift', music='jazzSwing', textStyle='gradient', uses=430000, bright=0.98, contrast=1.2),
    t('cc_supercar', 'Supercar Edit', 'Luxury', filter='chrome', effect='whipPan', music='deepBass', textStyle='impact', uses=370000, ratio='16x9', contrast=1.3),
    t('magnomGold', 'MAGNOM Gold', 'MAGNOM', filter='gold', effect='goalBurst', music='magnomAnthem', textStyle='gold', caption='MAGNOM CLUTCH', uses=45000, forYou=True, source='magnom'),
    t('sslPath', 'SSL Path', 'MAGNOM', filter='ice', effect='iceFx', music='sslGrind', textStyle='iceText', caption='SSL PATH', uses=38000, forYou=True, source='magnom'),
    t('clutchHeat', 'Clutch Heat', 'MAGNOM', filter='heat', effect='impact', music='clutch', textStyle='fireText', caption='CLUTCH GENIUS', uses=42000, trending=True, source='magnom'),
    t('whatASave', 'What A Save', 'MAGNOM', filter='vivid', effect='bounceBig', music='crowdCheer', textStyle='comic', caption='WHAT A SAVE', uses=31000, source='magnom'),
    t('flipReset', 'Flip Reset', 'MAGNOM', filter='cyberpunk', effect='spin', music='flipReset', textStyle='glowPink', caption='FLIP RESET', uses=29000, source='magnom'),
    t('demoed', 'Demoed', 'MAGNOM', filter='drama', effect='demoFx', music='demoHit', textStyle='impact', caption='DEMOED', uses=27000, source='magnom', photoDuration=5),
    t('arenaNeon', 'Arena Neon', 'MAGNOM', filter='neon', effect='neonGlitch', music='neonCity', textStyle='neon', caption='FULL SEND', uses=33000, trending=True, source='magnom'),
    t('tournament', 'Tournament Mode', 'MAGNOM', filter='cinema', effect='matchPoint', music='tournament', textStyle='impact', caption='TOURNAMENT MODE', uses=25000, source='magnom', ratio='16x9'),
    t('mustyPack', 'Musty Flick', 'MAGNOM', filter='sharp', effect='snap', music='musty', textStyle='outline', caption='MUSTY', uses=22000, source='magnom', photoDuration=5),
    t('airDribblePack', 'Air Dribble', 'MAGNOM', filter='teal', effect='float', music='aerial', textStyle='glowCyan', caption='AIR DRIBBLE', uses=20000, source='magnom'),
]

COVERS = [
    'linear-gradient(145deg,#0f0c29 0%,#302b63 50%,#24243e 100%)',
    'linear-gradient(145deg,#200122 0%,#6f0000 100%)',
    'linear-gradient(160deg,#0B1C2C 0%,#1B6CA8 50%,#5EEAD4 100%)',
    'linear-gradient(160deg,#2A0612 0%,#FE2C55 50%,#FF8A3D 100%)',
    'linear-gradient(160deg,#12061F 0%,#7C3AED 50%,#FE2C55 100%)',
    'linear-gradient(160deg,#1a1025 0%,#6366f1 50%,#f472b6 100%)',
    'linear-gradient(160deg,#134e4a 0%,#14b8a6 50%,#fef3c7 100%)',
    'linear-gradient(160deg,#3A2A00 0%,#F0B429 45%,#FE2C55 100%)',
    'linear-gradient(160deg,#0a1628 0%,#1e3a5f 42%,#7dd3fc 100%)',
    'linear-gradient(160deg,#1c1917 0%,#78716c 50%,#ef4444 100%)',
    'linear-gradient(160deg,#14532d 0%,#22c55e 40%,#fbbf24 100%)',
    'linear-gradient(160deg,#312e81 0%,#818cf8 50%,#f0abfc 100%)',
    'linear-gradient(160deg,#431407 0%,#ea580c 50%,#fde047 100%)',
    'linear-gradient(160deg,#042f2e 0%,#0d9488 55%,#a7f3d0 100%)',
    'linear-gradient(160deg,#4a044e 0%,#c026d3 50%,#f9a8d4 100%)',
    'linear-gradient(160deg,#0c0a09 0%,#44403c 45%,#d6d3d1 100%)',
    'linear-gradient(160deg,#1e1b4b 0%,#4f46e5 50%,#38bdf8 100%)',
    'linear-gradient(160deg,#450a0a 0%,#b91c1c 50%,#fca5a5 100%)',
    'linear-gradient(160deg,#052e16 0%,#15803d 50%,#86efac 100%)',
    'linear-gradient(160deg,#172554 0%,#1d4ed8 50%,#93c5fd 100%)',
]

for i, tpl in enumerate(templates):
    if not tpl.get('cover'):
        tpl['cover'] = COVERS[i % len(COVERS)]

CAT_COVERS = {
    'Slow Motion': 'linear-gradient(160deg,#0a1628 0%,#1e3a5f 42%,#7dd3fc 100%)',
    'Trending': 'linear-gradient(160deg,#FE2C55 0%,#FF8A3D 48%,#F0B429 100%)',
    'Attitude': 'linear-gradient(160deg,#1c1917 0%,#44403c 50%,#ef4444 100%)',
    'Viral': 'linear-gradient(160deg,#2e1065 0%,#a855f7 50%,#fe2c55 100%)',
    'Photo Dump': 'linear-gradient(160deg,#1a1025 0%,#6366f1 50%,#f472b6 100%)',
    'Beat Sync': 'linear-gradient(160deg,#1a0505 0%,#dc2626 50%,#fbbf24 100%)',
    'Cinematic': 'linear-gradient(160deg,#0a0a0a 0%,#374151 50%,#d4af37 100%)',
    'Vlog': 'linear-gradient(160deg,#134e4a 0%,#14b8a6 50%,#fef3c7 100%)',
    'Seasonal': 'linear-gradient(160deg,#14532d 0%,#fbbf24 50%,#f97316 100%)',
    'Aesthetic': 'linear-gradient(160deg,#4a044e 0%,#c026d3 50%,#f9a8d4 100%)',
    'Gaming': 'linear-gradient(160deg,#12061F 0%,#7C3AED 50%,#FE2C55 100%)',
    'Sports': 'linear-gradient(160deg,#071018 0%,#143B6B 45%,#F0B429 100%)',
    'Transition': 'linear-gradient(160deg,#1e1b4b 0%,#4f46e5 50%,#38bdf8 100%)',
    'Retro': 'linear-gradient(160deg,#431407 0%,#ea580c 50%,#fde047 100%)',
    'Nature': 'linear-gradient(160deg,#052e16 0%,#15803d 50%,#86efac 100%)',
    'Luxury': 'linear-gradient(160deg,#3A2A00 0%,#F0B429 45%,#FE2C55 100%)',
    'MAGNOM': 'linear-gradient(160deg,#3A2A00 0%,#F0B429 45%,#FE2C55 100%)',
}

lines = [f'/* {len(templates)} unique MAGNOMEDITS templates — CapCut + varied looks */', 'window.CUT_TEMPLATE_CATALOG = [']
for x in templates:
    parts = [f"id: '{x['id']}'", f"name: '{x['name']}'", f"cat: '{x['cat']}'"]
    for k in ['filter', 'effect', 'music', 'textStyle', 'caption', 'bright', 'contrast', 'saturate', 'ratio', 'fit', 'photoDuration', 'uses', 'badge', 'trending', 'forYou', 'source', 'cover']:
        if k not in x:
            continue
        v = x[k]
        if k == 'caption' and not v:
            continue
        if k == 'badge' and not v:
            continue
        if k in ('trending', 'forYou') and not v:
            continue
        if isinstance(v, str):
            parts.append(f"{k}: '{v}'")
        elif isinstance(v, bool):
            parts.append(f"{k}: {str(v).lower()}")
        else:
            parts.append(f"{k}: {v}")
    lines.append('    { ' + ', '.join(parts) + ' },')
lines.append('];')

catalog_path = Path(__file__).resolve().parents[1] / 'magnom-cut-catalog.js'
text = catalog_path.read_text()
start = text.index('/* CapCut trending')
end = text.index('// CapCut-style enrichment')
new_block = '\n'.join(lines) + '\n\n'
catalog_path.write_text(text[:start] + new_block + text[end:])

# patch enrichment covers in same file
text = catalog_path.read_text()
old_covers_start = text.index("const covers = {")
old_covers_end = text.index("    };", old_covers_start) + 6
new_covers = "const covers = {\n" + ''.join(f"        '{k}': '{v}',\n" for k, v in CAT_COVERS.items()) + "    }"
text = text[:old_covers_start] + new_covers + text[old_covers_end:]
# don't overwrite per-template cover if already set
text = text.replace(
    "    t.cover = t.cover || covers[t.cat] || covers.Trending;",
    "    if (!t.cover) t.cover = covers[t.cat] || covers.Trending;",
)
catalog_path.write_text(text)
print(f'Wrote {len(templates)} templates')
