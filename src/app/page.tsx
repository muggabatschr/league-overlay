'use client';

import { useState } from 'react';
import { Summoner, Match } from '@/types/league';
import MatchHistory from '@/components/MatchHistory';

export default function Home() {
  const [summonerName, setSummonerName] = useState('');
  const [summoner, setSummoner] = useState<Summoner | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!summonerName) return;

    setLoading(true);
    setError('');

    try {
      // Get summoner data from our API
      const summonerResponse = await fetch(`/api/summoner?name=${encodeURIComponent(summonerName)}`);
      if (!summonerResponse.ok) {
        throw new Error('Failed to fetch summoner data');
      }
      const summonerData = await summonerResponse.json();
      setSummoner(summonerData);

      // Get match history using the new endpoint that handles PUUID caching
      const matchesResponse = await fetch(`/api/matches-by-name?name=${encodeURIComponent(summonerName)}`);
      if (!matchesResponse.ok) {
        throw new Error('Failed to fetch match history');
      }
      const matchesData = await matchesResponse.json();
      setMatches(matchesData);
    } catch (err) {
      setError('Failed to fetch data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-center">League of Legends Match History</h1>
        
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              value={summonerName}
              onChange={(e) => setSummonerName(e.target.value)}
              placeholder="Enter summoner name#tag (e.g., Doublelift#NA1)"
              className="flex-1 p-2 border rounded-lg"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              {loading ? 'Loading...' : 'Search'}
            </button>
          </div>
        </form>

        {error && (
          <div className="p-4 mb-4 text-red-700 bg-red-100 rounded-lg">
            {error}
          </div>
        )}

        {summoner && (
          <div className="mb-8">
            <div className="flex items-center space-x-4">
              <img
                src={`https://ddragon.leagueoflegends.com/cdn/14.7.1/img/profileicon/${summoner.profileIconId}.png`}
                alt="Profile Icon"
                className="w-16 h-16 rounded-full"
              />
              <div>
                <h2 className="text-2xl font-semibold">{summoner.name}</h2>
                <p className="text-gray-600">Level {summoner.summonerLevel}</p>
              </div>
            </div>
          </div>
        )}

        {matches.length > 0 && (
          <MatchHistory matches={matches} summonerName={summonerName} />
        )}
      </div>
    </main>
  );
}
