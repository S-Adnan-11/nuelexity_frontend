import { Button } from "../ui/button";
import {createClient} from "@supabase/supabase-js";

const supabase = createClient(
  
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY!
);

async function Login (provider: "google" | "github") {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: provider
})

    if (error){
      alert(error.message)
    }
    else{
      console.log(data)
    }
  
}

export default function Auth () {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c]">
      <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16 ">
        <h1 className="text-5xl font-extrabold tracking-tight text-white sm:text-[5rem]">
          Auth

          <Button onClick={() => Login("google")}>Login with Google</Button>
          <Button onClick={() => Login("github")}>Login with GitHub</Button>
        </h1>
      </div>
    </div>
  );
}