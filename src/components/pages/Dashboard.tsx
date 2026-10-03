import { BACKEND_URL } from "@/lib/config";
import { Button } from "../ui/button";
import axios from "axios";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getInfo = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setUser(data.user);
      }
    };
    getInfo();
  }, []);

  useEffect(() => {
    async function getExistingConversation() {
      if (user) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const jwt = session?.access_token;
        const response = await axios.get(`${BACKEND_URL}/conversation`, {
          headers: {
            Authorization: jwt,
          },
        });
        console.log("JWT Token:", jwt);
        console.log(response.data);
      }
    }
    getExistingConversation();
  }, [user]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
      <h1 className="text-4xl font-bold mb-4">Dashboard</h1>

      {!user && (
        <Button
          onClick={() => {
            navigate("/auth");
          }}
        >
          Sign In
        </Button>
      )}

      {user && (
        <div className="flex flex-col items-center gap-4">
          <p>Welcome, {user.email}!</p>
          <Button
            onClick={() => {
              supabase.auth.signOut().then(() => {
                setUser(null);
                navigate("/auth");
              });
            }}
          >
            Logout
          </Button>
        </div>
      )}
    </div>
  );
}