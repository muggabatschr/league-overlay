import { Match, Participant } from '@/types/league';
import Image from 'next/image';

interface MatchHistoryProps {
  matches: Match[];
  summonerName: string;
}

export default function MatchHistory({ matches, summonerName }: MatchHistoryProps) {
  const getParticipant = (match: Match): Participant | undefined => {
    return match.info.participants.find(p => p.riotIdTagline === summonerName.split("#")[1].toUpperCase() && p.riotIdGameName === summonerName.split("#")[0]);
  };

  const formatDuration = (duration: number): string => {
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {matches.map((match) => {
        const participant = getParticipant(match);
        if (!participant) return null;

        return (
          <div
            key={match.metadata.matchId}
            className={`p-4 rounded-lg ${
              participant.win ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="relative w-12 h-12">
                  <Image
                    src={`https://ddragon.leagueoflegends.com/cdn/15.8.1/img/champion/${participant.championName}.png`}
                    alt={participant.championName}
                    fill
                    className="rounded-full"
                  />
                </div>
                <div>
                  <h3 className="font-semibold">{participant.championName}</h3>
                  <p className="text-sm text-gray-600">
                    {participant.kills}/{participant.deaths}/{participant.assists}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {participant.win ? 'Victory' : 'Defeat'}
                </p>
                <p className="text-sm text-gray-600">
                  {formatDuration(match.info.gameDuration)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
} 