import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return <div className="grid min-h-[100dvh] place-items-center bg-[#b91c1c] text-white"><div className="text-center"><span className="mx-auto grid size-20 place-items-center rounded-[1.75rem] bg-white text-4xl font-bold text-[#b91c1c] shadow-xl">汉</span><p className="mt-5 font-bold tracking-[0.18em]">CHINESE REVIEW</p><p className="mt-2 text-sm text-red-100">Preparing your lesson…</p><LoaderCircle className="mx-auto mt-5 animate-spin text-red-200" size={24} /></div></div>;
}
