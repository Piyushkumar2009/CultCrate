/** Hand curated cohorts served only when every Gemini model is overloaded (see app/api/recommendations/route.ts). */
export function getOfflineCalibratedCohorts() {
  return {
    taste_profile_summary:
      'High affinity for clinical psychological dread, rain-soaked neo-noir lighting, and uncompromising auteur cinematography. Calibrated directly from the offline Vault screening archives.',
    masterpiece_cohort: [
      {
        title: 'Memories of Murder',
        year: 2003,
        genre: ['Crime', 'Drama', 'Mystery'],
        country: 'South Korea',
        runtime_mins: 131,
        imdb_rating: 8.1,
        posterUrl: '',
        content_advisory: 'Disturbing Serial Homicide Themes & Rain-Soaked Atmosphere',
        where_to_watch_india: 'Prime Video India, MUBI India, Apple TV Store',
        audio_availability: 'Korean Original Master • English Subtitles',
        spoiler_free_premise:
          'In a rural province in 1986, two ill-equipped detectives struggle with brutality, missing forensic evidence, and psychological exhaustion while pursuing South Korea\'s first serial murderer.',
        thematic_alignment:
          'Unmatched chiaroscuro night cinematography, moral decay, and razor-sharp procedural tension matching your top-rated Korean neo-noirs.',
        scale_projection: 'Masterpiece',
        director: 'Bong Joon-ho',
      },
      {
        title: 'Cure',
        year: 1997,
        genre: ['Crime', 'Horror', 'Mystery'],
        country: 'Japan',
        runtime_mins: 111,
        imdb_rating: 7.5,
        posterUrl: '',
        content_advisory: 'Hypnotic Psychological Horror & Existential Nihilism',
        where_to_watch_india: 'MUBI India, Criterion Channel (VPN), Apple TV Store',
        audio_availability: 'Japanese Master • English Subtitles',
        spoiler_free_premise:
          'A burnt-out Tokyo detective investigates identical gruesome murders committed by ordinary people who have no memory of their actions after encountering an amnesiac wanderer.',
        thematic_alignment:
          'Clinical spatial staging, industrial sound design, and hypnotic psychological tension tailored to deep cinephile appreciation.',
        scale_projection: 'Masterpiece',
        director: 'Kiyoshi Kurosawa',
      },
      {
        title: 'Burning',
        year: 2018,
        genre: ['Drama', 'Mystery', 'Thriller'],
        country: 'South Korea',
        runtime_mins: 148,
        imdb_rating: 7.5,
        posterUrl: '',
        content_advisory: 'Slow-Burn Existential Enigma & Class Tension',
        where_to_watch_india: 'Netflix India, Prime Video India, MUBI India',
        audio_availability: 'Korean 5.1 Surround • English Subtitles',
        spoiler_free_premise:
          'An aspiring novelist encounters a childhood acquaintance and a wealthy, mysterious playboy whose strange secret hobby ignites an obsessive investigation.',
        thematic_alignment:
          'A quiet masterclass in atmospheric pacing, natural twilight lighting, and subtle class friction adapted from Haruki Murakami.',
        scale_projection: 'Masterpiece',
        director: 'Lee Chang-dong',
      },
      {
        title: 'Stalker',
        year: 1979,
        genre: ['Sci-Fi', 'Drama', 'Mystery'],
        country: 'Soviet Union',
        runtime_mins: 162,
        imdb_rating: 8.1,
        posterUrl: '',
        content_advisory: 'Metaphysical Philosophical Dread & Toxic Industrial Hazards',
        where_to_watch_india: 'Criterion Channel, YouTube Cinema Arthouse, MUBI India',
        audio_availability: 'Russian Mono Master • English Subtitles',
        spoiler_free_premise:
          'A guide leads a melancholic writer and a cynical professor through a hazardous, sentient post-apocalyptic wasteland known as The Zone to locate a room that grants deep desires.',
        thematic_alignment:
          'Legendary long takes, sepia tones transitioning into vibrant overgrown landscapes, and transcendental spiritual metaphysics.',
        scale_projection: 'Masterpiece',
        director: 'Andrei Tarkovsky',
      },
    ],
    excellent_cohort: [
      {
        title: 'Possession',
        year: 1981,
        genre: ['Horror', 'Drama'],
        country: 'France / West Germany',
        runtime_mins: 124,
        imdb_rating: 7.3,
        posterUrl: '',
        content_advisory: 'Severe Psychological Hysteria & Surrealist Body Horror',
        where_to_watch_india: 'MUBI India, Metrograph at Home, Apple TV (Rent)',
        audio_availability: 'Original English Master',
        spoiler_free_premise:
          'Against the backdrop of the Berlin Wall, a spy returns home to his unraveling marriage only to discover his wife has formed an unspeakable metaphysical liaison.',
        thematic_alignment:
          'Extreme unhinged acting performances, visceral bodily terror, and profound Cold War socio-political allegories.',
        scale_projection: 'Excellent',
        director: 'Andrzej Żuławski',
      },
      {
        title: 'On the Silver Globe',
        year: 1988,
        genre: ['Sci-Fi', 'Drama', 'Fantasy'],
        country: 'Poland',
        runtime_mins: 166,
        imdb_rating: 7.2,
        posterUrl: '',
        content_advisory: 'Hallucinatory Sci-Fi Metaphysics & Pagan Savagery',
        where_to_watch_india: 'Eastern Promises India, MUBI India, Archival 4K',
        audio_availability: 'Polish Master • English Subtitles',
        spoiler_free_premise:
          'Astronauts crash-land on an alien planet and establish a primal society that gradually devolves into religious mythology and pagan tribal warfare over generations.',
        thematic_alignment:
          'A monumental Polish science fiction odyssey that pushed European visionary cinema to its absolute ecstatic and philosophical boundaries.',
        scale_projection: 'Excellent',
        director: 'Andrzej Żuławski',
      },
      {
        title: 'The Conversation',
        year: 1974,
        genre: ['Drama', 'Mystery', 'Thriller'],
        country: 'USA',
        runtime_mins: 113,
        imdb_rating: 7.8,
        posterUrl: '',
        content_advisory: 'Psychological Paranoia & Surveillance Tension',
        where_to_watch_india: 'Prime Video India, Apple TV Store, Criterion Channel',
        audio_availability: 'English 5.1 Surround',
        spoiler_free_premise:
          'A secretive and obsessive surveillance expert suspects that a routine audio recording of a young couple conversing in a crowded park portends a corporate murder.',
        thematic_alignment:
          'Masterful sound design editing by Walter Murch, acoustic dread, and unmatched character characterization of solitary guilt.',
        scale_projection: 'Excellent',
        director: 'Francis Ford Coppola',
      },
      {
        title: 'Blow Out',
        year: 1981,
        genre: ['Crime', 'Mystery', 'Thriller'],
        country: 'USA',
        runtime_mins: 108,
        imdb_rating: 7.4,
        posterUrl: '',
        content_advisory: 'Political Conspiracy & Sound-Induced Paranoia',
        where_to_watch_india: 'Criterion Channel, Prime Video (VOD), MUBI India',
        audio_availability: 'English Dolby Surround',
        spoiler_free_premise:
          'A movie sound technician accidentally records audio proof of a political assassination when a car carrying a governor plunges off a bridge.',
        thematic_alignment:
          'Brian De Palma\'s split-diopter camera brilliance, vibrant color palettes, and devastating, cynical conclusions.',
        scale_projection: 'Excellent',
        director: 'Brian De Palma',
      },
    ],
  };
}
