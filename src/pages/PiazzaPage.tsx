import { app, db } from "../firebase";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useState, useEffect } from "react";
import CircularIndeterminate from "../components/CircularIndeterminate";

export default function PiazzaPage() {
  // Set initial states
  const [userID, setUserID] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [piazzaData, setPiazzaData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Necessary to get user info later on
  const auth = getAuth(app);

  // On initial load, retrieves announcements
  useEffect(() => {
    const fetchData = async () => {
      onAuthStateChanged(auth, async (user: any) => {
        setUserID(user.uid);
        const docRef = doc(db, `users/${user.uid}`);
        const docSnap = await getDoc(docRef);
        const data = docSnap.data();

        // If access token doesn't exist, display authorize button
        if (!data || !data.gmailApiAccessToken) setAuthorized(true);
        else {
          const date = new Date(
            data.gmailApiAccessTokenExpiration.seconds * 1000 +
              data.gmailApiAccessTokenExpiration.nanoseconds / 1000000
          );
          if (date > new Date()) {
            // Access token not expired so get announcement
            connectPiazza(user.uid);
          } else {
            // Access token expired, thus get new token and then get announcements
            await getPiazzaNewToken(user.uid);
            connectPiazza(user.uid);
          }
        }
      });
    };
    fetchData();
  }, []);

  // Generate googleauth url
  const state = JSON.stringify({ userID: userID });
  const encodedState = encodeURIComponent(state);
  const YOUR_FIREBASE_FUNCTION_URL = `http://127.0.0.1:5001/edusync-e6e17/us-central1/exchangeToken`;
  const YOUR_CLIENT_ID =
    "642660880490-eofmqqgspbhulqckmbbplt9q97j69af6.apps.googleusercontent.com";
  const GOOGLE_AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${YOUR_CLIENT_ID}&redirect_uri=${encodeURIComponent(
    YOUR_FIREBASE_FUNCTION_URL
  )}&response_type=code&scope=${encodeURIComponent(
    "https://www.googleapis.com/auth/gmail.readonly"
  )}&access_type=offline&prompt=consent&state=${encodedState}`;

  // Invoke when user clicks authorize button
  const handleLogin = () => {
    window.location.href = GOOGLE_AUTH_URL;
  };

  const connectPiazza = async (userId: any) => {
    setLoading(true);
    const result = await fetch(
      `http://127.0.0.1:5001/edusync-e6e17/us-central1/getPiazzaAnnouncements?userID=${userId}`
    );
    const data = await result.json();
    setPiazzaData(data);
    setLoading(false);
  };

  const getPiazzaNewToken = async (userId: any) => {
    const result = await fetch(
      `http://127.0.0.1:5001/edusync-e6e17/us-central1/getPiazzaNewAccessToken?userID=${userId}`
    );
    const data = await result.json();
  };

  const display = piazzaData.map((elem: any) => {
    let encoded_text_plain = elem.payload.parts[0].parts[0].body.data;
    encoded_text_plain = encoded_text_plain
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    encoded_text_plain += "=".repeat((4 - (encoded_text_plain.length % 4)) % 4);
    let decoded_text_plain = atob(encoded_text_plain);

    const arr = decoded_text_plain.split(" ");
    if (arr[0] === "Instructor") {
      return (
        <div className="border border-black rounded-xl p-5">
          <div>{elem.payload.headers[33].value.split("on Piazza")[0]}</div>
          <div>{decoded_text_plain.split("Go to https://piazza")[0]}</div>
        </div>
      );
    }
  });

  return (
    <div>
      <h2 className="text-5xl text-center mb-10 mt-5">
        Piazza Instructor Announcements
      </h2>
      <div className="flex justify-center gap-6 mb-10">
        {authorized && <button onClick={handleLogin}>Authorize</button>}
      </div>
      {loading ? (
        <CircularIndeterminate />
      ) : (
        <div className="flex flex-col gap-9 px-9">{display}</div>
      )}
    </div>
  );
}
