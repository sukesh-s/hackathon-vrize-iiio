import axios from 'axios';

const audioApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 10 * 60 * 1000,
});

export async function transcribeCall(
  audioFile: File,
  metadataFile: File,
  onUploadProgress: (progress: number) => void,
) {
  const form = new FormData();
  form.append('audio', audioFile);
  form.append('metadata', metadataFile);

  const response = await audioApi.post('/audio/transcribe', form, {
    onUploadProgress: (event) => {
      if (event.total) onUploadProgress(Math.round((event.loaded / event.total) * 100));
    },
  });

  return response.data;
}
