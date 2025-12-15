import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router";
import { usePuterStore } from "~/lib/puter"

export const meta = () => ([
  { title: "Auth - Resume AI Analyser" },
  { name: "description", content: "Authenticate to access Resume AI Analyser features." }
])

const auth = () => {
  const { isLoading, auth } = usePuterStore();
  const location = useLocation();
  const next = location.search.split('next=')[1];
  const navigate = useNavigate();

  useEffect(() => {
    if(auth.isAuthenticated) navigate(next);
      [auth.isAuthenticated, next]
  })

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-[60vh] flex items-center justify-center pt-0 py-8">
      <div className="gradient-border shadow-lg w-full max-w-xl mx-4">
        <section className="flex flex-col gap-5 bg-white rounded-2xl p-6 w-full justify-center max-h-[460px]">
          <div className="flex flex-col items-center gap-2 text-center">
            <h1 className="text-4xl font-semibold">Welcome to Resume AI Analyser</h1>
            <p className="text-base text-dark-200 max-w-xl mx-auto">Please sign in to continue and unlock powerful resume analysis features.</p>
          </div>
          <div>
            {isLoading ? (
              <button className="auth-button animate-pulse items-center justify-center">
                 <p>Signing in</p>
              </button>
            ) : (
              <>
                {auth.isAuthenticated ? (
                  <button className="auth-button" onClick={auth.signOut}>
                   <p>SignOut</p> 
                  </button>
                ):(
                  <button className="auth-button" onClick={auth.signIn}>
                    <p>SignIn</p>
                  </button>
                )}
              </>
            )}
          </div>
        </section>

      </div>
    </main>
  )
}

export default auth