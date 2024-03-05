import { useEffect, useState } from "react";
import { cloneDeep } from "lodash";

import { useSocket } from "@/context/socket";
import usePeer from "@/hooks/usePeer";
import useMediaStream from "@/hooks/useMediaStream";
import usePlayer from "@/hooks/usePlayer";

import Player from "@/component/Player";
import Bottom from "@/component/Bottom";
import CopySection from "@/component/CopySection";

import styles from "@/styles/room.module.css";
import { useRouter } from "next/router";

// const TranscriptionDisplay = ({ transcriptions }) => (
//   <div>
//     {Object.entries(transcriptions).map(([userId, transcription]) => (
//       <p key={userId}><strong>User ID:</strong> {userId} - <strong>Transcription:</strong> {transcription}</p>
//     ))}
//   </div>
// );

const Room = () => {
  const socket = useSocket();
  const { roomId } = useRouter().query;
  const { peer, myId } = usePeer();
  const { stream } = useMediaStream();
  const {
    players,
    setPlayers,
    playerHighlighted,
    nonHighlightedPlayers,
    toggleAudio,
    toggleVideo,
    leaveRoom
  } = usePlayer(myId, roomId, peer);

  const [users, setUsers] = useState([]);
  const [transcriptions, setTranscriptions] = useState({});

  useEffect(() => {
    if (!socket || !peer || !stream) return;
    const handleUserConnected = (newUser) => {
      console.log(`user connected in room with userId ${newUser}`);

      const call = peer.call(newUser, stream);

      call.on("stream", (incomingStream) => {
        console.log(`incoming stream from ${newUser}`);
        setPlayers((prev) => ({
          ...prev,
          [newUser]: {
            url: incomingStream,
            muted: true,
            playing: true,
          },
        }));

        setUsers((prev) => ({
          ...prev,
          [newUser]: call
        }))
      });
    };
    socket.on("user-connected", handleUserConnected);

    return () => {
      socket.off("user-connected", handleUserConnected);
    };
  }, [peer, setPlayers, socket, stream]);

  useEffect(() => {
    if (!stream || !myId) return;
    console.log(`setting my stream ${myId}`);
    setPlayers((prev) => ({
      ...prev,
      [myId]: {
        url: stream,
        muted: true,
        playing: true,
      },
    }));
  }, [myId, setPlayers, stream]);

  useEffect(() => {
    if (!peer || !stream) return;
    peer.on("call", (call) => {
      const { peer: callerId } = call;
      call.answer(stream);

      call.on("stream", (incomingStream) => {
        console.log(`incoming stream from ${callerId}`);
        setPlayers((prev) => ({
          ...prev,
          [callerId]: {
            url: incomingStream,
            muted: true,
            playing: true,
          },
        }));

        setUsers((prev) => ({
          ...prev,
          [callerId]: call
        }))
      });
    });
  }, [peer, setPlayers, stream]);

  useEffect(() => {
    if (!stream) return;
  
    // Check if SpeechRecognition API is available
    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
      recognition.lang = "en-US";
      
      recognition.onresult = (event) => {
        const transcription = event.results[0][0].transcript;
        console.log('Transcription:', transcription);
        setTranscriptions((prev) => ({
          ...prev,
          [myId]: transcription
        }));
        // Handle the transcription here
      };
      
      recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        // Handle recognition errors here
      };
  
      recognition.onend = () => {
        // console.log('Recognition ended. Restarting...');
        // Restart recognition for continuous transcription
        recognition.start();
      };
  
      recognition.start();
    } else {
      console.error("SpeechRecognition API is not supported in this browser");
    }
  }, [stream]);

  return (
    <>
      <div className={styles.activePlayerContainer}>
        
        {playerHighlighted && (
          <Player
            url={playerHighlighted.url}
            muted={playerHighlighted.muted}
            playing={playerHighlighted.playing}
            isActive
          />
        )}
      </div>
      <div className={styles.inActivePlayerContainer}>
        {Object.keys(nonHighlightedPlayers).map((playerId) => {
          const { url, muted, playing } = nonHighlightedPlayers[playerId];
          return (
            <Player
              key={playerId}
              url={url}
              muted={muted}
              playing={playing}
              isActive={false}
            />
          );
        })}
      </div>
      <CopySection roomId={roomId}/>
      <Bottom
        muted={playerHighlighted?.muted}
        playing={playerHighlighted?.playing}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        leaveRoom={leaveRoom}
      />
      {/* {Object.keys(transcriptions).length > 0 && <TranscriptionDisplay transcriptions={transcriptions} />} */}
    </>
  );
};

export default Room;
