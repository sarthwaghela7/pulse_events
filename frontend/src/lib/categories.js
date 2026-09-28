export const categories = ['Singer', 'DJ', 'Band', 'Dancer', 'Comedian', 'Magician']
export const categoryFields = {
  Singer: [
    { key: 'genres', label: 'Music genres', placeholder: 'Bollywood, Sufi, acoustic' },
    { key: 'languages', label: 'Languages you perform in', placeholder: 'Hindi, English' },
    { key: 'set_length', label: 'Typical set length', placeholder: '2 hours' },
    { key: 'setup', label: 'Setup you bring', placeholder: 'Microphone and sound system' },
  ],
  DJ: [
    { key: 'genres', label: 'Music styles', placeholder: 'Bollywood, house, hip-hop' },
    { key: 'set_length', label: 'Typical set length', placeholder: '4 hours' },
    { key: 'setup', label: 'Equipment you bring', placeholder: 'Controller, speakers, lights' },
    { key: 'event_types', label: 'Events you play', placeholder: 'Weddings, parties, clubs' },
  ],
  Band: [
    { key: 'genres', label: 'Music genres', placeholder: 'Indie, pop, rock' },
    { key: 'members', label: 'Number of band members', placeholder: '4' },
    { key: 'set_length', label: 'Typical set length', placeholder: '90 minutes' },
    { key: 'setup', label: 'Stage and sound needs', placeholder: 'PA system and four microphones' },
  ],
  Dancer: [
    { key: 'styles', label: 'Dance styles', placeholder: 'Bollywood, contemporary' },
    { key: 'performers', label: 'Number of performers', placeholder: '1' },
    { key: 'set_length', label: 'Performance length', placeholder: '30 minutes' },
    { key: 'space', label: 'Space needed', placeholder: 'A clear 4m × 4m floor' },
  ],
  Comedian: [
    { key: 'languages', label: 'Languages you perform in', placeholder: 'English, Hindi' },
    { key: 'audience', label: 'Best audience', placeholder: 'Adults, family, corporate' },
    { key: 'set_length', label: 'Typical set length', placeholder: '45 minutes' },
    { key: 'style', label: 'Comedy style', placeholder: 'Observational, clean' },
  ],
  Magician: [
    { key: 'show_type', label: 'Type of magic', placeholder: 'Close-up, stage illusions' },
    { key: 'audience', label: 'Best audience', placeholder: 'All ages' },
    { key: 'set_length', label: 'Show length', placeholder: '60 minutes' },
    { key: 'setup', label: 'Space or equipment needs', placeholder: 'Small stage and table' },
  ],
}
export const timeSlots = [
  { label: 'Morning', time: '10:00' },
  { label: 'Afternoon', time: '14:00' },
  { label: 'Evening', time: '18:00' },
  { label: 'Night', time: '21:00' },
]
