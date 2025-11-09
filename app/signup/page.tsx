import SignupForm from './signup-form';

export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <SignupForm />
      </div>
    </div>
  );
}
