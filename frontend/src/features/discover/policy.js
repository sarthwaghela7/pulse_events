export const composerState = ({ user, listed }) => !user ? 'signed-out' : listed ? 'enabled' : 'listing-required'
