import { BACKEND_URL } from "@/lib/config";
import {Button} from "../ui/button";
import axios from "axios";
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
// import {createClient} from "../../lib/supabase/client";
import {createClient} from "@supabase/supabase-js";
import type {User} from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import {useNavigate} from "react-router";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

export default function Dashboard () {

    const navigate = useNavigate();
    const [user, setUser] = useState<User | null>(null);

    useEffect(() => {
        const getInfo = async () => {
            const { data, error } = await supabase.auth.getUser();
            if (data.user) {
                setUser(data.user);
            }
        };
        getInfo();
    }, []);

    useEffect(() => {
        async function getExistingConversation() {
            // Implementation for getting existing conversation
            if (user){
                const {data: { session}} = await supabase.auth.getSession()
                const jwt = session?.access_token;
                const response = await axios.get(`${BACKEND_URL}/conversations`, {
                    headers: {
                        Authorization: jwt,
                    },
                })
                console.log("JWT Token:", jwt);
                console.log(response.data)
            }
            
        }
        getExistingConversation();
    }, []);


    return <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
            <h1>
                Dashboard!
            </h1>

            {!user && <Button onClick={()=>{
                navigate("/auth");
                <div>Not signed in</div>
            }}>Sign In</Button>
            }

            {user && <div>
                {user?.email}
                {user?.email ? <p>Welcome, {user.email}!</p> : <p>Loading user info...</p>}

                <Button onClick ={() => {
                    supabase.auth.signOut().then(() => {
                        setUser(null);
                        navigate("/auth");
                    });
                    
                }
                }>Logout</Button>

            </div>
            };

        </div>
        }