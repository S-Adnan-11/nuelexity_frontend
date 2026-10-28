import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { accountProfile } from "../lib/profile";
import { BrandMark } from "./Brand";

export function Avatar({ user, size = 36 }: { user: User; size?: number }) {
  const profile = accountProfile(user);
  const [failed, setFailed] = useState<string | null>(null);
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * .32 }} aria-hidden="true">
    {profile.avatar && failed !== profile.avatar ? <img src={profile.avatar} alt="" referrerPolicy="no-referrer" onError={() => setFailed(profile.avatar)} />
      : profile.initials || <BrandMark size={Math.round(size * .55)} />}
  </span>;
}
