"""Create two demo logins and five demo artists in each category.

Run after schema.sql (or upgrade.sql for an existing database):
    python seed.py

Requires backend/.env with a real SUPABASE_SERVICE_ROLE_KEY. Safe to rerun: demo
accounts are updated and artist records use stable IDs.
"""

import os
import secrets
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name('.env'))

URL = os.getenv('SUPABASE_URL', '').rstrip('/')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')
PASSWORD = 'password'

ARTISTS = {
    'Singer': ['Aarav Mehta', 'Mira Kapoor', 'Riya Sen', 'Kabir Sethi', 'Ananya Rao'],
    'DJ': ['DJ Nova', 'DJ Kairo', 'DJ Pulse', 'DJ Tara', 'DJ Veda'],
    'Band': ['The River Notes', 'Midnight Atlas', 'The Marigolds', 'City Lights Collective', 'Monsoon Avenue'],
    'Dancer': ['Ishita Dance Co.', 'Rhythm House', 'Nisha Verma', 'The Motion Project', 'Rang Dance Crew'],
    'Comedian': ['Rohan Malhotra', 'Neha Batra', 'Arjun Khanna', 'Sana Mirza', 'Dev Nair'],
    'Magician': ['The Great Ishaan', 'Zara Mystique', 'Armaan Illusions', 'Mystic Maya', 'The Wonder Lab'],
}
CITIES = ['Mumbai', 'Bengaluru', 'Delhi', 'Pune', 'Hyderabad']
PRICES = {'Singer': 15000, 'DJ': 18000, 'Band': 30000, 'Dancer': 16000, 'Comedian': 12000, 'Magician': 14000}
DESCRIPTIONS = {
    'Singer': 'Live vocals for weddings, private celebrations, and memorable evenings.',
    'DJ': 'A dance floor ready mix for parties, receptions, and corporate events.',
    'Band': 'A live set blending crowd favourites with an original sound.',
    'Dancer': 'Expressive live performances tailored to your celebration.',
    'Comedian': 'A lively stand up set that gets the whole room laughing.',
    'Magician': 'Interactive illusions and close up magic for guests of every age.',
}
PHOTOS = {
    'Singer': 'photo-1516280440614-37939bbacd81',
    'DJ': 'photo-1571266028243-d220c9c3c157',
    'Band': 'photo-1493225457124-a3eb161ffa5f',
    'Dancer': 'photo-1508700115892-45ecd05ae2ad',
    'Comedian': 'photo-1527224857830-43a7acc85260',
    'Magician': 'photo-1514533212735-5df27d970db0',
}
DETAILS = {
    'Singer': {'genres': 'Bollywood, acoustic', 'languages': 'Hindi, English', 'set_length': '2 hours', 'setup': 'Microphone and sound system'},
    'DJ': {'genres': 'Bollywood, house', 'set_length': '4 hours', 'setup': 'DJ controller, speakers and lights', 'event_types': 'Weddings and parties'},
    'Band': {'genres': 'Pop, indie', 'members': '4', 'set_length': '90 minutes', 'setup': 'PA system and four microphones'},
    'Dancer': {'styles': 'Bollywood, contemporary', 'performers': '3', 'set_length': '30 minutes', 'space': 'Clear stage area'},
    'Comedian': {'languages': 'Hindi, English', 'audience': 'Adults and corporate', 'set_length': '45 minutes', 'style': 'Observational comedy'},
    'Magician': {'show_type': 'Close-up and stage magic', 'audience': 'All ages', 'set_length': '60 minutes', 'setup': 'Small stage and table'},
}


def request(client, method, path, **kwargs):
    response = client.request(method, path, **kwargs)
    if response.is_error:
        raise RuntimeError(f'{method} {path}: {response.status_code} {response.text[:300]}')
    return response.json() if response.content else None


def ensure_user(client, known_users, email, name, password=None):
    existing = known_users.get(email)
    payload = {'email': email, 'password': password or secrets.token_urlsafe(32), 'email_confirm': True, 'user_metadata': {'full_name': name}}
    if existing:
        if password:
            user = request(client, 'PUT', f"/auth/v1/admin/users/{existing['id']}", json=payload)
        else:
            user = existing
    else:
        user = request(client, 'POST', '/auth/v1/admin/users', json=payload)
        known_users[email] = user
    return user['id']


def main():
    if not URL or not KEY or KEY.startswith('FILL_IN'):
        raise SystemExit('Set a real SUPABASE_SERVICE_ROLE_KEY in backend/.env, then run python seed.py.')
    headers = {'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Content-Type': 'application/json'}
    with httpx.Client(base_url=URL, headers=headers, timeout=30) as client:
        users_response = request(client, 'GET', '/auth/v1/admin/users', params={'page': 1, 'per_page': 1000})
        known_users = {user['email'].lower(): user for user in users_response.get('users', []) if user.get('email')}
        demo_artist_id = ensure_user(client, known_users, 'artist@gmail.com', 'Demo Artist', PASSWORD)
        demo_user_id = ensure_user(client, known_users, 'user@gmail.com', 'Demo User', PASSWORD)
        profiles = [
            {'id': demo_artist_id, 'email': 'artist@gmail.com', 'full_name': 'Demo Artist', 'role': 'user'},
            {'id': demo_user_id, 'email': 'user@gmail.com', 'full_name': 'Demo User', 'role': 'user'},
        ]
        records = []
        for category, names in ARTISTS.items():
            for index, name in enumerate(names):
                sample_email = f"demo-artist-{len(records) + 1:02d}@evntra.example"
                owner_id = ensure_user(client, known_users, sample_email, name)
                profiles.append({'id': owner_id, 'email': sample_email, 'full_name': name, 'role': 'user'})
                records.append({
                    'id': str(uuid5(NAMESPACE_URL, f'evntra-demo:{category}:{index}')),
                    'user_id': owner_id,
                    'name': name,
                    'category': category,
                    'bio': f'{name} brings {DESCRIPTIONS[category].lower()} Available for a performance shaped around your event.',
                    'city': CITIES[index],
                    'price_per_event': PRICES[category] + index * 2500,
                    'profile_image_url': f"https://images.unsplash.com/{PHOTOS[category]}?auto=format&fit=crop&w=900&q=80",
                    'tags': [category, CITIES[index], 'Events'],
                    'details': DETAILS[category],
                })
        request(client, 'POST', '/rest/v1/profiles', params={'on_conflict': 'id'}, headers={'Prefer': 'resolution=merge-duplicates'}, json=profiles)
        request(client, 'POST', '/rest/v1/artists', params={'on_conflict': 'id'}, headers={'Prefer': 'resolution=merge-duplicates'}, json=records)
        print('Seeded 30 demo artists (5 in each of 6 categories).')
        print('Either demo login can book or create one listing: artist@gmail.com / password or user@gmail.com / password')


if __name__ == '__main__':
    main()
